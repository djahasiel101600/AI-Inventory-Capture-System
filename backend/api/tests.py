from django.test import TestCase, Client
from django.urls import reverse

class ApiSmokeTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_extract_requires_image(self):
        resp = self.client.post(reverse('product_extract'), {})
        self.assertEqual(resp.status_code, 400)
