from rest_framework import serializers
from .models import ProductCapture

class ProductCaptureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCapture
        fields = ['id','image','product_name','unit','description','category','confidence','created_at']
