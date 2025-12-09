import uuid
from django.db import models

class ProductCapture(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    image = models.ImageField(upload_to='captures/')
    product_name = models.CharField(max_length=512, blank=True)
    unit = models.CharField(max_length=128, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=64, blank=True)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product_name} ({self.id})"
