from rest_framework import serializers
from .models import ProductCapture

class ProductCaptureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCapture
        fields = '__all__'
        read_only_fields = ('id', 'created_at')