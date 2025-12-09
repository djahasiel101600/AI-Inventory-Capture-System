import base64
from openai import OpenAI

client = OpenAI(api_key="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")

# Function to encode the image
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


prompt = (
            "Analyze the following product image using vision and the provided OCR text.\n"
            "Extract only these fields and return valid JSON:\n"
            "- product_name\n- unit\n- description\n- category (Food, Medicine, Drinks, Hygiene, Insecticide, Cleanings)\n- confidence (0 to 1)\n\n"
        )
# Path to your image
image_path = r"C:\Users\Administrator\Downloads\sample.jpg"

# Getting the Base64 string
base64_image = encode_image(image_path)


response = client.responses.create(
    model="gpt-4.1",
    input=[
        {
            "role": "user",
            "content": [
                { "type": "input_text", "text": prompt },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image}",
                },
            ],
        }
    ],
)

print(response.output_text)