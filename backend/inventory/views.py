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
            # Prefer the smaller vision-capable model (gpt-mini-4) and instruct it
            # to prioritize visual analysis. Provide OCR text as auxiliary input.
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "text",
                                                "text": (
                                                    "You are an assistant with strong visual reasoning. "
                                                    "Prioritize understanding the image contents when extracting product information. "
                                                    "Use OCR only as an auxiliary hint if the image text is unclear or partially occluded. "
                                                    "Return only a valid JSON array of objects (even if there is only one item). "
                                                    "Each object should contain the requested fields."
                                                ),
                            }
                        ]
                    },
                    {
                        "role": "user",
                        "content": [
                                {
                                    "type": "text",
                                            "text": f"""
                                            Analyze the following product image using vision and the provided OCR text.
                                            Return a JSON array of detected items (even if only one). For each item, include these fields:
                                
                                            - product_name
                                            - unit (e.g., "500g", "1L", "12pcs")
                                            - description (short text)
                                            - category (Food, Medicine, Drinks, Hygiene, Insecticide, Cleanings, School Supplies, Office Supplies, Tobacco, Alcohol, Bread & Pastries, Baby Products, Pet Supplies, Hardware & Electrical, Clothing & Accessories, Mobile Load & E-Services, Rice & Grains)
                                            - confidence (0 to 1, estimate based on clarity and completeness)
                                
                                            OCR Text: {ocr_text}
                                
                                            Use the image and OCR together. If uncertain, lower the confidence score.
                                            Return JSON only (an array of objects).
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

            def extract_json_from_text(text: str):
                """Try several strategies to extract a JSON object/array from text.

                Strategies (in order):
                - Look for fenced code blocks labelled json (```json ... ```)
                - Look for any triple-backtick block and attempt parse
                - Find the first balanced JSON object {...}
                - Find the first balanced JSON array [...]
                - Fallback: attempt to locate first '{'..'}' span and parse
                """
                # 1) fenced code block with json
                import re

                # Allow fenced blocks that contain either an object or an array
                fenced_json = re.search(r"```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```", text, re.IGNORECASE)
                if fenced_json:
                    candidate = fenced_json.group(1)
                    try:
                        return json.loads(candidate)
                    except Exception:
                        pass

                # 2) any triple-backtick block
                triple = re.search(r"```([\s\S]*?)```", text)
                if triple:
                    c = triple.group(1).strip()
                    # try as-is
                    try:
                        return json.loads(c)
                    except Exception:
                        # maybe the block contains other text; try to find braces inside
                        pass

                # 3) balanced-brace object or array scanning
                def find_balanced(text, open_ch, close_ch):
                    start = None
                    depth = 0
                    for i, ch in enumerate(text):
                        if ch == open_ch:
                            if start is None:
                                start = i
                            depth += 1
                        elif ch == close_ch and start is not None:
                            depth -= 1
                            if depth == 0:
                                return text[start:i+1]
                    return None

                # Prefer array first, then object (avoids capturing only first object when model returned an array)
                arr = find_balanced(text, '[', ']')
                if arr:
                    try:
                        return json.loads(arr)
                    except Exception:
                        pass

                obj = find_balanced(text, '{', '}')
                if obj:
                    try:
                        return json.loads(obj)
                    except Exception:
                        pass

                # 4) Fallback: locate first '{'.. last '}' and attempt
                s = text.find('{')
                e = text.rfind('}')
                if s != -1 and e != -1 and e > s:
                    candidate = text[s:e+1]
                    try:
                        return json.loads(candidate)
                    except Exception as exc:
                        raise ValueError(f'Failed to parse JSON from candidate substring: {exc}')

                # Nothing worked
                raise ValueError('No JSON object or array found in model response')

            try:
                parsed = extract_json_from_text(content)
            except Exception as parse_err:
                # include model content snippet for debugging (trim to reasonable length)
                snippet = content[:2000] + ('...' if len(content) > 2000 else '')
                raise ValueError(f'Failed to extract JSON from model response: {parse_err}; response snippet: {snippet}')

            # Normalize to list
            if isinstance(parsed, dict):
                items = [parsed]
            elif isinstance(parsed, list):
                items = parsed
            else:
                raise ValueError('Parsed model response is neither object nor array')

            # Respect a max_items parameter to limit saves and cost
            try:
                max_items = int(request.data.get('max_items', 10))
            except Exception:
                max_items = 10

            items = items[:max_items]

            saved_objects = []
            # Save each detected item as a ProductCapture
            for idx, it in enumerate(items):
                # Basic validation and defaults
                name = it.get('product_name') if isinstance(it, dict) else None
                unit = it.get('unit') if isinstance(it, dict) else ''
                desc = it.get('description') if isinstance(it, dict) else ''
                cat = it.get('category') if isinstance(it, dict) else 'Food'
                conf = it.get('confidence') if isinstance(it, dict) else 0.0

                if not name:
                    # skip items without a product_name
                    continue

                # Create ProductCapture and attach image (same file for each item)
                timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
                image_name = f"capture_{timestamp}_{idx}.jpg"
                content_file = ContentFile(image_bytes, name=image_name)

                product_capture = ProductCapture(
                    product_name=name,
                    unit=unit or '',
                    description=desc or '',
                    category=cat or 'Food',
                    confidence=float(conf) if conf is not None else 0.0,
                    session_id=session_id
                )
                product_capture.image.save(content_file.name, content_file, save=False)
                product_capture.save()
                saved_objects.append(product_capture)

            serializer = ProductCaptureSerializer(saved_objects, many=True)

            # If debug flag provided in request, include the raw model content and parsed items
            debug_flag = str(request.data.get('debug', False)).lower() in ('1', 'true', 'yes')
            if debug_flag:
                # Return saved objects plus the model's full content and the parsed JSON
                print({
                    'saved': serializer.data,
                    'parsed_items': items,
                    'model_content': content,
                })
                return Response({
                    'saved': serializer.data,
                    'parsed_items': items,
                    'model_content': content,
                })

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