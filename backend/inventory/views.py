import base64
import pytesseract
from PIL import Image
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.db.models import Count, Max
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from openai import OpenAI
import json
from .models import ProductCapture
from .serializers import ProductCaptureSerializer
import csv
from django.utils import timezone
import io
from django.core.files.base import ContentFile

class ProductExtractView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request, format=None):
        image_file = request.FILES.get('image')
        session_id = request.data.get('session_id', 'default')

        if not image_file:
            return Response({'error': 'No image provided'}, status=400)

        # Read uploaded file into bytes once and reuse (prevents EOF/file-pointer issues)
        try:
            image_bytes = image_file.read()
        except Exception:
            return Response({'error': 'Failed to read uploaded image'}, status=400)

        # Perform OCR using PIL from bytes
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return Response({'error': f'Invalid image file: {e}'}, status=400)

        ocr_text = pytesseract.image_to_string(pil_image)

        # Prepare image for GPT (base64 from same bytes)
        image_data = base64.b64encode(image_bytes).decode('utf-8')
        
        # Call GPT Vision API
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        try:
            response = client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"""
                                Analyze the following product image using vision and the provided OCR text.
                                Extract only these fields and return valid JSON:
                                
                                - product_name
                                - unit (e.g., "500g", "1L", "12pcs")
                                - description (short text)
                                - category (Food, Medicine, Drinks, Hygiene, Insecticide, Cleanings, School Supplies, Office Supplies, Tobacco, Alcohol, Bread & Pastries, Baby Products, Pet Supplies, Hardware & Electrical, Clothing & Accessories, Mobile Load & E-Services, Rice & Grains)
                                - confidence (0 to 1, estimate based on clarity and completeness)
                                
                                OCR Text: {ocr_text}
                                
                                Use the image and OCR together. If uncertain, lower the confidence score.
                                Return JSON only.
                                """
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300,
            )
            
            # Parse GPT response
            content = response.choices[0].message.content
            # Extract JSON from response
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            json_str = content[json_start:json_end]
            extracted_data = json.loads(json_str)
            
            # Save to database. Use ContentFile to attach the bytes to the ImageField
            image_name = getattr(image_file, 'name', None) or f'capture_{timezone.now().strftime("%Y%m%d%H%M%S")}.jpg'
            content_file = ContentFile(image_bytes, name=image_name)

            product_capture = ProductCapture(
                product_name=extracted_data.get('product_name', ''),
                unit=extracted_data.get('unit', ''),
                description=extracted_data.get('description', ''),
                category=extracted_data.get('category', 'Food'),
                confidence=extracted_data.get('confidence', 0.0),
                session_id=session_id
            )
            # assign file to image field and save
            product_capture.image.save(content_file.name, content_file, save=False)
            product_capture.save()
            
            serializer = ProductCaptureSerializer(product_capture)
            return Response(serializer.data)
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class ExportCSVView(APIView):
    def get(self, request):
        session_id = request.query_params.get('session_id', 'default')
        
        # Get products for this session
        products = ProductCapture.objects.filter(session_id=session_id)
        
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="inventory_export_{session_id}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['product_name', 'unit', 'description', 'category', 'confidence'])
        
        for product in products:
            writer.writerow([
                product.product_name,
                product.unit,
                product.description,
                product.category,
                product.confidence
            ])
        
        return response

class SaveSessionView(APIView):
    def post(self, request):
        serializer = ProductCaptureSerializer(data=request.data, many=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
class HealthCheckView(APIView):
    def get(self, request):
        return Response({'status': 'healthy', 'timestamp': timezone.now()})

class SessionProductsView(APIView):
    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required'}, status=400)
        
        products = ProductCapture.objects.filter(session_id=session_id).order_by('-created_at')
        serializer = ProductCaptureSerializer(products, many=True)
        return Response(serializer.data)

from django.shortcuts import get_object_or_404
from django.core.files.uploadedfile import UploadedFile

class ProductDetailView(APIView):
    renderer_classes = [JSONRenderer]
    
    def get_object(self, pk):
        return get_object_or_404(ProductCapture, pk=pk)
    
    def put(self, request, pk):
        product = self.get_object(pk)
        # Make a mutable copy of incoming data so we can sanitize it.
        data = request.data.copy()

        # If the client sent an `image` field but it's not an uploaded file
        # (e.g. a URL or a JSON string), remove it so the ImageField
        # validation does not raise "The submitted data was not a file".
        img = data.get('image', None)
        if img and not isinstance(img, UploadedFile):
            data.pop('image', None)

        serializer = ProductCaptureSerializer(product, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        # Return validation errors (helpful for debugging client 400s)
        return Response(serializer.errors, status=400)
    
    def delete(self, request, pk):
        product = self.get_object(pk)
        product.delete()
        return Response({'message': 'Product deleted successfully'}, status=204)

class ClearSessionView(APIView):
    def delete(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required'}, status=400)
        
        deleted_count, _ = ProductCapture.objects.filter(session_id=session_id).delete()
        return Response({'deleted': deleted_count})
    


class SessionsListView(APIView):
    """Return a list of sessions with counts and last seen timestamp."""
    def get(self, request):
        sessions = (
            ProductCapture.objects
            .values('session_id')
            .annotate(count=Count('id'), last_seen=Max('created_at'))
            .order_by('-last_seen')
        )

        # Normalize session_id (empty strings -> 'default')
        result = [
            {
                'session_id': s['session_id'] or 'default',
                'count': s['count'],
                'last_seen': s['last_seen'],
            }
            for s in sessions
        ]

        return Response(result)