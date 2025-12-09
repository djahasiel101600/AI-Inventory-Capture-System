from django.urls import path
from . import views

urlpatterns = [
    path('product/extract/', views.ProductExtractView.as_view(), name='product_extract'),
    path('export/csv/', views.export_csv, name='export_csv'),
    path('session/save/', views.session_save, name='session_save'),
]
