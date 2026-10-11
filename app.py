import pandas as pd

# 读取 CSV 文件
df = pd.read_csv("score.csv")

# 1. 打印原始表格
print("原始成绩表：")
print(df.to_string(index=False))

print("\n各科成绩统计：")

# 2. 统计各科总分、平均分和最高分
subjects = ["语文", "数学", "英语"]

for subject in subjects:
    total = df[subject].sum()
    average = df[subject].mean()
    maximum = df[subject].max()

    print(f"\n{subject}：")
    print(f"总分：{total}")
    print(f"平均分：{average:.2f}")
    print(f"最高分：{maximum}")
