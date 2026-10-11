import tkinter as tk
from PIL import Image, ImageTk, ImageOps


IMAGE_PATH = "python.jpg"
SAVE_PATH = "python_gray.jpg"


root = tk.Tk()
root.title("图片灰度处理")
root.geometry("600x450")


# 读取原始图片
original_image = Image.open(IMAGE_PATH).convert("RGB")


def show_image(img):
    """在窗口中显示图片"""

    preview = img.copy()
    preview.thumbnail((500, 300))

    tk_image = ImageTk.PhotoImage(preview)

    image_label.config(image=tk_image)
    image_label.image = tk_image


def convert_gray():
    """转换成灰度图并保存"""

    gray_image = ImageOps.grayscale(original_image)

    # JPG 保存时转换为 RGB
    gray_rgb = gray_image.convert("RGB")
    gray_rgb.save(SAVE_PATH, "JPEG")

    show_image(gray_rgb)

    result_label.config(
        text=f"转换完成，图片已保存为：{SAVE_PATH}"
    )


image_label = tk.Label(root)
image_label.pack(pady=20)


gray_button = tk.Button(
    root,
    text="转换为灰度图",
    command=convert_gray,
    width=20,
    height=2
)

gray_button.pack(pady=10)


result_label = tk.Label(root, text="")
result_label.pack(pady=10)


# 首先显示原始图片
show_image(original_image)


root.mainloop()