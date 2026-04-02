from PIL import Image

input_path = r"c:\4-1\AushadX\apps\mobile-client\assets\adaptive-icon-foreground.png"
output_path = r"c:\4-1\AushadX\apps\mobile-client\assets\notification-icon.png"

def make_silhouette():
    try:
        img = Image.open(input_path).convert("RGBA")
        alpha = img.split()[3]
        
        # Check if it's completely opaque
        extrema = alpha.getextrema()
        if extrema[0] == 255 and extrema[1] == 255:
            print("WARNING: The foreground icon is completely opaque (no transparent background). The notification icon will just be a solid square.")
            
        new_img = Image.new("RGBA", img.size, (255, 255, 255, 255))
        new_img.putalpha(alpha)
        new_img.save(output_path)
        print("Successfully generated white silhouette icon.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    make_silhouette()
