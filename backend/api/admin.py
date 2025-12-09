from django.contrib import admin
from .models import ProductCapture

@admin.register(ProductCapture)
class ProductCaptureAdmin(admin.ModelAdmin):
    list_display = ('product_name','category','confidence','created_at')
