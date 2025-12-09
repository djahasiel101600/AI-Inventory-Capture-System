from django.db import models
import uuid

class ProductCapture(models.Model):
    CATEGORY_CHOICES = [
        ('Food', 'Food'),
        ('Drinks', 'Drinks'),
        ('Medicine', 'Medicine'),
        ('Hygiene', 'Hygiene'),
        ('Cleaning Supplies', 'Cleaning Supplies'),
        ('Insecticide', 'Insecticide'),
        ('School Supplies', 'School Supplies'),
        ('Office Supplies', 'Office Supplies'),
        ('Tobacco', 'Tobacco'),
        ('Alcohol', 'Alcohol'),
        ('Frozen Goods', 'Frozen Goods'),
        ('Bread & Pastries', 'Bread & Pastries'),
        ('Baby Products', 'Baby Products'),
        ('Pet Supplies', 'Pet Supplies'),
        ('Hardware & Electrical', 'Hardware & Electrical'),
        ('Clothing & Accessories', 'Clothing & Accessories'),
        ('Mobile Load & E-Services', 'Mobile Load & E-Services'),
        ('Rice & Grains', 'Rice & Grains'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    image = models.ImageField(upload_to='captures/')
    product_name = models.CharField(max_length=255)
    unit = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    confidence = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    session_id = models.CharField(max_length=100, blank=True)  # For session grouping
    
    def __str__(self):
        return f"{self.product_name} ({self.confidence*100:.1f}%)"