#!/usr/bin/env python3
"""
Create a simple icon for Afarensis Enterprise
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon():
    """Create a simple icon for the application"""
    try:
        # Create a 256x256 image with blue background
        size = 256
        img = Image.new('RGBA', (size, size), (30, 64, 175, 255))  # Afarensis blue
        draw = ImageDraw.Draw(img)
        
        # Draw a simple "A" for Afarensis
        try:
            # Try to use a system font
            font_size = 180
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)  # Mac
            except:
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)  # Linux
                except:
                    font = ImageFont.load_default()  # Fallback
        
        # Calculate text position to center it
        text = "A"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2 - 10
        
        # Draw white "A"
        draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
        
        # Add a small subtitle
        try:
            small_font = ImageFont.truetype("arial.ttf", 24)
        except:
            small_font = font
        
        subtitle = "Enterprise"
        bbox = draw.textbbox((0, 0), subtitle, font=small_font)
        sub_width = bbox[2] - bbox[0]
        sub_x = (size - sub_width) // 2
        sub_y = y + text_height + 10
        
        draw.text((sub_x, sub_y), subtitle, fill=(255, 255, 255, 200), font=small_font)
        
        # Save as ICO (multiple sizes for Windows)
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        images = []
        
        for icon_size in sizes:
            resized = img.resize(icon_size, Image.Resampling.LANCZOS)
            images.append(resized)
        
        # Save as ICO file
        img.save('afarensis_icon.ico', format='ICO', sizes=[(size, size) for size in sizes])
        print("✅ Icon created: afarensis_icon.ico")
        return True
        
    except ImportError:
        print("⚠️ PIL/Pillow not available - creating minimal icon")
        create_minimal_icon()
        return True
    except Exception as e:
        print(f"⚠️ Icon creation failed: {e}")
        create_minimal_icon()
        return True

def create_minimal_icon():
    """Create a minimal ICO file without PIL"""
    # This creates a very basic 16x16 ICO file
    ico_data = b'\x00\x00\x01\x00\x01\x00\x10\x10\x00\x00\x01\x00\x08\x00\x68\x05\x00\x00\x16\x00\x00\x00'
    ico_data += b'\x28\x00\x00\x00\x10\x00\x00\x00\x20\x00\x00\x00\x01\x00\x08\x00\x00\x00\x00\x00'
    ico_data += b'\x40\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00'
    
    # Add a simple color palette (256 colors)
    for i in range(256):
        if i == 0:
            ico_data += b'\x1E\x40\xAF\x00'  # Afarensis blue
        elif i == 1:
            ico_data += b'\xFF\xFF\xFF\x00'  # White
        else:
            ico_data += bytes([i, i, i, 0])  # Grayscale
    
    # Add 16x16 pixel data (very simple pattern)
    pixel_data = b'\x00' * 256  # All blue background
    ico_data += pixel_data
    
    # Add mask data
    mask_data = b'\x00' * 32
    ico_data += mask_data
    
    with open('afarensis_icon.ico', 'wb') as f:
        f.write(ico_data)
    
    print("✅ Minimal icon created: afarensis_icon.ico")

if __name__ == "__main__":
    create_icon()
