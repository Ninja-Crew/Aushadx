import shutil

# The user requested to use adaptive-icon-foreground.png exactly as is, including colors.
shutil.copy(
    r"c:\4-1\AushadX\apps\mobile-client\assets\adaptive-icon-foreground.png", 
    r"c:\4-1\AushadX\apps\mobile-client\assets\notification-icon.png"
)
print("Restored notification-icon.png from adaptive-icon-foreground.png")
