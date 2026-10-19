# 线上预测服务连接说明

网页地址、模型后端地址和 Supabase API 是三个不同的地址。本项目的网页部署在 Vercel，Python GRU 模型后端按仓库的 `render.yaml` 部署，Supabase 保存输入和输出数据。

```mermaid
flowchart LR
    Web[Vercel 网页] --> Model[Python GRU 模型服务 / Render]
    Model --> DB[Supabase 数据库]
    DB --> Model
    Model --> Web
```

网页显示 `Supabase: Live` 说明病人数据连接正常，不能说明 Python 模型已经上线。此前完成的真实 Supabase 预测验证使用的是本地 Python 后端。

## 1. 部署 Python 后端

在 [Render Dashboard](https://dashboard.render.com/) 选择 **New → Blueprint**，连接 `AA-4499/FYP-A-Sep-2026`，选择 **TrainingModel** 分支，使用根目录的 `render.yaml`。先核对即将创建的服务，再部署。参见 [Render Blueprint 官方步骤](https://render.com/docs/infrastructure-as-code)。

按配置填写后端环境变量：

| 变量 | 内容 |
| --- | --- |
| `SUPABASE_URL` | 你的 Supabase 项目地址 |
| `SUPABASE_KEY` | 本地 `models/training/.env` 中的服务器密钥；仅填到 Python 后端 |
| `ALLOWED_ORIGINS` | 你正在使用的 Vercel 网页完整 origin；多个地址用英文逗号分隔 |

部署完成后复制 Render 显示的实际服务地址。在浏览器打开 `服务地址/api/health`，应返回 JSON，包含 `"status": "healthy"`。

本文件中的 `https://your-model-service.onrender.com` 只是格式示例，不是已经存在的服务。

## 2. 将网页连接到模型后端

有两种设置方式：

- 当前浏览器：打开 Risk Prediction 页面右上角 **Service connection**，填入刚部署的 Python 服务地址，点击 **Connect and retry**。不要填 Supabase 项目地址或 Vercel 网页地址。这个设置只影响当前浏览器。
- 所有访问者：在 Vercel 项目的环境变量中设置 `VITE_API_BASE_URL` 为同一个 Python 服务地址，按需要覆盖 Production 和 Preview，然后重新部署前端。参见 [Vercel 环境变量说明](https://vercel.com/docs/environment-variables)。

地址仅填写 origin，例如 `https://your-model-service.onrender.com`；不要附加 `/api`。

如果服务已连接但显示 403，按 `training-model-migration.md` 的 Authentication 说明检查 Supabase 用户的可信 `app_metadata` 角色和病人权限。网页上显示的角色名称本身不能授予后端权限。

## 3. 页面显示

- 上方：数据来源、预测时长和关键数值。
- 中间主内容区：预测图；其下是 CGM 训练、验证和测试历史图。
- 更下方：MAE/RMSE、时间覆盖范围、逐点预测表、CSV 下载、模型与数据详情。
- 右侧：What-if simulator。

服务尚未连接或请求失败时，图表和详情区域会保留，显示等待结果状态。已有成功结果时，重新计算或失败重试不会清空同一病人、来源和时长的上一份曲线；页面会标明正在更新或保留了上次结果。切换病人、来源或时长时，不会把旧结果作为新选择的结果显示。
