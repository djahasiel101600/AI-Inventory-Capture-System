from django.urls import path
from . import views

urlpatterns = [
    path('product/extract/', views.ProductExtractView.as_view(), name='extract-product'),
    path('export/csv/', views.ExportCSVView.as_view(), name='export-csv'),
    path('session/save/', views.SaveSessionView.as_view(), name='save-session'),
    path('session/products/', views.SessionProductsView.as_view(), name='session-products'),
    path('session/clear/', views.ClearSessionView.as_view(), name='clear-session'),
    path('health/', views.HealthCheckView.as_view(), name='health-check'),
    path('product/<uuid:pk>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('sessions/', views.SessionsListView.as_view(), name='sessions-list'),
]