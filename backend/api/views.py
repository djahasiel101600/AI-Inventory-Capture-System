import io
import csv
import re
from django.http import JsonResponse, HttpResponse
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import ProductCapture
from .serializers import ProductCaptureSerializer

from PIL import Image
import pytesseract

def simple_gpt_simulator(ocr_text, image_path):
    """
    Simulate GPT Vision + OCR extraction. This is a placeholder.
    Production integration should call GPT-4.1 mini with image + ocr_text.
    """
    # heuristics: first non-empty line -> product_name
    lines = [l.strip() for l in ocr_text.splitlines() if l.strip()]
    product_name = lines[0] if lines else ''

    # find unit pattern
    unit = ''
    for m in re.finditer(r"\b(\d+(?:[.,]\d+)?\s?(g|kg|ml|l|L|pcs|pc|pcs|pack|tablet|tab))\b", ocr_text, re.IGNORECASE):
        unit = m.group(0)
        break

    # description: everything after first line
    description = ' '.join(lines[1:3]) if len(lines) > 1 else ''

    # very naive category mapping
    categories = ['Food','Medicine','Drinks','Hygiene','Insecticide','Cleanings']
    cat = ''
    t = ocr_text.lower()
    if any(k in t for k in ['milk','bread','rice','soup']):
        cat = 'Food'
    elif any(k in t for k in ['soap','shampoo','toothpaste']):
        cat = 'Hygiene'
    elif any(k in t for k in ['drink','juice','cola','beer']):
        cat = 'Drinks'
    elif any(k in t for k in ['tablet','capsule','medicine','mg']):
        cat = 'Medicine'
    else:
        cat = 'Food'

    # confidence heuristic: more lines and a unit increases confidence
    confidence = 0.5
    if product_name:
        confidence += 0.2
    if unit:
        confidence += 0.15
    if len(lines) >= 2:
        confidence += 0.1
    confidence = min(0.99, confidence)

    return {
        'product_name': product_name,
        'unit': unit,
        'description': description,
        'category': cat,
        'confidence': round(confidence, 2)
    }


@method_decorator(csrf_exempt, name='dispatch')
class ProductExtractView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, format=None):
        file_obj = request.FILES.get('image')
        if not file_obj:
            return Response({'detail':'image file required'}, status=status.HTTP_400_BAD_REQUEST)

        # Save instance first (image)
        pc = ProductCapture.objects.create(image=file_obj)

        # Run OCR
        try:
            img = Image.open(pc.image.path)
            ocr_text = pytesseract.image_to_string(img)
        except Exception as e:
            ocr_text = ''

        # Call GPT (simulator here)
        result = simple_gpt_simulator(ocr_text, pc.image.path)

        # update model
        pc.product_name = result.get('product_name','')
        pc.unit = result.get('unit','')
        pc.description = result.get('description','')
        pc.category = result.get('category','')
        pc.confidence = float(result.get('confidence',0))
        pc.save()

        serializer = ProductCaptureSerializer(pc)
        return Response({**serializer.data}, status=status.HTTP_201_CREATED)


def export_csv(request):
    qs = ProductCapture.objects.all().order_by('created_at')
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(['product_name','unit','description','category','confidence'])
    for p in qs:
        writer.writerow([p.product_name,p.unit,p.description,p.category,p.confidence])

    resp = HttpResponse(buffer.getvalue(), content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename="product_captures.csv"'
    return resp


def session_save(request):
    # Optional endpoint — for now accept JSON and store products array if provided
    if request.method != 'POST':
        return JsonResponse({'detail':'method not allowed'}, status=405)
    try:
        import json
        body = json.loads(request.body.decode('utf-8'))
        items = body.get('items', [])
        saved = []
        for it in items:
            p = ProductCapture.objects.create(
                product_name=it.get('product_name',''),
                unit=it.get('unit',''),
                description=it.get('description',''),
                category=it.get('category',''),
                confidence=float(it.get('confidence',0))
            )
            saved.append(str(p.id))
        return JsonResponse({'saved': saved})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
