
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { ExtractionType, FusionRequest, ChatMessage } from "../types";

const createGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("缺少 API_KEY 环境变量。");
  }
  
  // 支持自定义中转 API 地址 (GEMINI_BASE_URL)
  const baseUrl = process.env.GEMINI_BASE_URL;
  if (baseUrl) {
    return new GoogleGenAI({ 
      apiKey, 
      httpOptions: { baseUrl } 
    });
  }
  
  return new GoogleGenAI({ apiKey });
};

// 工具：清洗 JSON 字符串（去除 Markdown 标记）
const cleanJsonString = (text: string): string => {
  if (!text) return "{}";
  // 移除 ```json 和 ```
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  // 尝试找到第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

// 策略：全量转 Base64 (inlineData)，不经过 Files API
const fileToInlineData = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log(`Reading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:video/mp4;base64," or "data:image/png;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 新增：多模态产品提取 (图片 + PDF + 文本)
export const extractCharacterAsset = async (
  files: File[], 
  promptText: string
): Promise<string> => {
  const ai = createGeminiClient();

  try {
    const parts: any[] = [];

    // 1. 处理所有文件转 Base64
    for (const file of files) {
      const base64Data = await fileToInlineData(file);
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    }

    // 2. 添加文本 Prompt
    const systemPrompt = `
      🤖 智能体名称：角色资产三视图指导 (Character Asset Director)
      🌟 核心任务 (Core Mission)
      当用户上传一张或多张人物图片/视频时，你负责将其视觉特征（容貌、发型、服装、配饰）精准提取，并生成一段高度标准化的 AI 绘画提示词。该提示词旨在生成一张包含“头部高清特写 + 全身三视图”的专业角色人设图（Character Sheet）。

      🛠️ 角色设定与工作流 (System Role & Workflow)
      第一步：视觉特征逆向拆解
      头部细节：发型（双麻花辫等）、发色、配饰（粉色刺绣帽等）、五官特征。
      上装特征：材质、颜色、图案（动物团花等）、剪裁方式。
      下装特征：款式（紫色短裙等）、长度、材质。
      鞋包配件：鞋子款式（薄荷绿运动鞋等）、书包细节（多色撞色、挂饰、水瓶）。

      第二步：指令合成 (Prompt Synthesis)
      你需要将上述信息填入以下**“强制排版模板”**中，生成最终提示词：

      [写实摄影风格/用户指定画风]，一张专业的角色设定图（Character Sheet）。
      【空间布局】：画面左上角为该角色的头部高清正面特写（Headshot），展示细腻的面部皮肤、发型及帽子细节。画面右侧及下方并列展示该角色的全身三视图（正面视图、侧面视图、背面视图）。
      【角色形象】：[此处填入拆解出的外貌与发型描述]。
      【服装细节】：[此处填入拆解出的服装、裙子/裤子描述]。
      【道具配饰】：[此处填入书包、手持物、鞋子描述]。
      【视觉规范】：背景使用极简的高级中性灰（Neutral Grey），影棚级柔光。画面包含灰色中文标注文字：“头部细节”、“正面视图”、“侧面视图”、“背面视图”。
      【技术参数】：8K超高清，UE5渲染感，电影级灯光，极其纯净的构图，无背景杂物，16:9。

      🎨 交互规则 (Interaction Rules)
      语言强制：生成的最终 AI 提示词（Prompt）**必须全部使用中文**，绝对不要使用英文。
      支持定制：如果用户在上传图片的同时输入了额外要求（例如：“换成红色的裙子”、“背景要纯白”），你必须在生成的提示词中优先体现这些修改，并在回复中告知用户：“已按要求修改了[特定细节]”。
      格式固定：严格按照上述【空间布局】的逻辑编写，确保 AI 绘图模型能理解多视图的排版。
      负向过滤：在输出提示词后，额外附带一组通用的 Negative Prompt（负向提示词）。

      📝 输出示例 (Output Example)
      请严格按照以下格式输出（直接输出文本，不要使用 JSON 格式）：

      ✅ 视觉资产拆解完成
      头部：[分析内容]
      服装：[分析内容]
      额外修改：[用户提出的特定要求，如果没有则写“无”]

      🎨 最终 AI 提示词 (Copy & Paste)
      [生成的完整英文/中文提示词内容...]

      🚫 负向提示词 (Negative Prompt)
      低分辨率，文字，错误，裁剪，最差质量，低质量，jpeg伪影，丑陋，重复，病态，残缺，出框，多余的手指，变异的手，画得很差的手，画得很差的脸，变异，畸形，模糊，脱水，不良的解剖结构，不良的比例，多余的肢体，克隆的脸，毁容，恶心的比例，畸形的肢体，缺失的手臂，缺失的腿，多余的手臂，多余的腿，融合的手指，太多的手指，长脖子，用户名，水印，签名
    `;

    parts.push({ text: systemPrompt });
    if (promptText) {
      parts.push({ text: `用户额外补充说明/修改要求: ${promptText}` });
    }

    console.log(`Sending character asset request with ${files.length} files...`);

    const apiCall = ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: parts
      }
    });

    const response: any = await apiCall;
    return response.text || "未能生成提示词";

  } catch (error: any) {
    console.error("Gemini Character Asset Error:", error);
    throw new Error(`角色资产提取失败: ${error.message || "未知错误"}`);
  }
};

export const generateViralVideoPrompt = async (files: File[], promptText: string): Promise<string> => {
  const ai = createGeminiClient();
  try {
    const parts: any[] = [];
    
    for (const file of files) {
      const base64Data = await fileToInlineData(file);
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    }

    const systemPrompt = `
      🌟 核心定位
      你是一名顶级 AI 视频提示词专家，专门负责将用户上传的视频或描述，反推为适用于 即梦 (Jimeng/Seedance) 2.0 模型的专业镜头脚本。你的目标是生成具备“电影感”、“高转化率”且“逻辑严密”的 9:16 短视频提示词。

      🛠️ 任务指令与工作流
      第一步：深度拆解 (Visual Profile)
      当用户上传视频或图片后，你必须首先输出“场景视觉档案”，包含以下维度：
      环境设定：精准描述室内外场景（如：深夜餐厅、接送车内、简约厨房）。
      角色建模：定义角色 A 和 B 的年龄、核心衣着锚点（如：拼色衬衫、条纹衫）、配饰（如：紫色细框眼镜）。
      光影灵魂：定义布光风格（如：孤岛式布光、体积光、自然侧光、低调摄影）。
      构图策略：默认优先采用“过肩镜头 (OTS)”。强调前景虚化（占画面 1/3）与主体焦点的深度对比。

      第二步：镜头反推 (Prompt Generation)
      根据用户提供的对话内容，将视频拆解为 4-5 个快节奏分镜。每个镜头的提示词必须包含：
      格式规范：[核心参数 + 禁令] + 【构图/景别】 + 【主体描述】 + 【动作/口播指令】。
      强制禁令：在每个提示词开头必须加入：[4K 电影实拍感，9:16，全图严禁生成任何文字或字幕]。
      口播同步：描述人物嘴部自然开合，并精准嵌入用户提供的台词。

      第三步：后期避坑指南 (Advanced Tips)
      在提示词下方输出“视觉总监执行规程”，固定包含：
      负向提示词 (Negative Prompt)：提供一套强力的屏蔽词（字幕、对话框、水印等）。
      一致性策略：指导用户如何使用角色参考 Seed 和材质参考。
      构图微调：如何通过描述词控制前景虚化（Gaussian blur）的程度。

      ✍️ 输出格式模板（严格遵守）
      收到！已经为你彻底重置。这组视频是一个典型的“[场景关键词]”场景，核心在于“[核心痛点/反转点]”。

      📄 场景视觉档案 (Visual Style Profile)
      环境设定：...
      角色设定：...
      构图策略：优先采用过肩镜头 (OTS)，利用前景虚化人物增加真实的空间层次感。

      🎨 即梦 Seedance 2.0 专用：[场景名称]版（X 镜头）
      镜头 1：【分镜名】 (景别)
      提示词：[4K 电影实拍感，9:16，全图严禁生成任何文字或字幕]。【构图】：... 【主体】：... 【口播动作】：嘴部自然同步开合说出台词：“[台词内容]”。
      (以此类推生成后续镜头...)

      🛠️ 视觉总监的防字幕与一致性操作规程：
      强力去字幕拦截 (Negative Prompt)：字幕, 对话框, 文字, 标题, 封面文案, 浮窗, 黑色字条, subtitle, text, caption, watermark, banner, on-screen text 🚫。
      角色一致性参考：...
      过肩镜头的秘诀：...

      🚫 行为禁令
      严禁输出图片：你的任务是输出文字提示词，除非用户明确要求生成图样参考。
      严禁遗漏台词：用户提供的对话内容必须 100% 还原在口播动作描述中。
      严禁过度简化：必须包含对光影、材质、皮肤纹理、微表情的细腻捕捉。
      严格避开“大头贴”：除非是特定的情绪极写实特写，否则优先使用过肩或中景构图。
    `;

    parts.push({ text: systemPrompt });
    if (promptText) {
      parts.push({ text: `用户额外补充说明/修改要求: ${promptText}` });
    }

    console.log(`Sending viral video prompt request with ${files.length} files...`);

    const apiCall = ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: parts
      }
    });

    const response: any = await apiCall;
    return response.text || "未能生成提示词";

  } catch (error: any) {
    console.error("Gemini Viral Video Prompt Error:", error);
    throw new Error(`视频拆解失败: ${error.message || "未知错误"}`);
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = createGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        
        // Return base64 data URI instead of blob URL.
        // Blob URLs expire on page reload and cannot be shared.
        // Data URIs are permanently embedded in the markdown.
        return `data:${mimeType};base64,${base64EncodeString}`;
      }
    }
    throw new Error("未找到生成的图片数据");
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    throw new Error(`图片生成失败: ${error.message || "未知错误"}`);
  }
};

export const extractMultimodalInfo = async (
  files: File[], 
  promptText: string
): Promise<{ script: string, analysis: string }> => {
  const ai = createGeminiClient();

  try {
    const parts: any[] = [];

    // 1. 处理所有文件转 Base64
    for (const file of files) {
      const base64Data = await fileToInlineData(file);
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      });
    }

    // 2. 添加文本 Prompt
    const systemPrompt = `
      任务：你是一位专业的电商产品经理。请分析用户提供的产品资料（图片、PDF手册、文字描述）。
      
      请提取关键信息并返回一个 JSON 对象，包含以下两个字段：
      1. "script": 产品详细介绍汇总。请整合所有资料中的产品基础信息、规格参数、使用场景描述等。（纯文本，整理成通顺的段落）。
      2. "analysis": 深度卖点与痛点分析。
         - 核心卖点（USP）：产品最打动人的地方。
         - 用户痛点：解决了什么实际问题？
         - 竞品差异：相比同类产品有什么优势？
         - 适用人群：谁最需要这个产品？
         请使用 Markdown 格式列点输出。
    `;

    parts.push({ text: systemPrompt });
    if (promptText) {
      parts.push({ text: `用户额外补充说明: ${promptText}` });
    }

    console.log(`Sending multimodal request with ${files.length} files...`);

    const apiCall = ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', // 使用 Pro 模型以获得更好的多模态理解能力
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["script", "analysis"]
        }
      }
    });

    const response: any = await apiCall;
    const rawText = response.text || "";
    const jsonText = cleanJsonString(rawText);
    const result = JSON.parse(jsonText);

    // Process to handle literal \n in JSON strings
    const processText = (text: string) => text ? text.replace(/\\n/g, '\n') : "";

    return {
        script: processText(result.script || "未提取到产品详情"),
        analysis: processText(result.analysis || "未提取到卖点分析")
    };

  } catch (error: any) {
    console.error("Gemini Multimodal Error:", error);
    throw new Error(`多模态解析失败: ${error.message || "未知错误"}`);
  }
};

export const extractVideoInfo = async (file: File, type: ExtractionType): Promise<{ script: string, analysis: string }> => {
  const ai = createGeminiClient();
  
  try {
    // 1. 直接将文件转换为 Base64
    console.log("Converting file to Base64...");
    const base64Data = await fileToInlineData(file);
    
    // 2. 构建请求部分
    const contentPart = { 
      inlineData: { 
        mimeType: file.type || "video/mp4", 
        data: base64Data 
      } 
    };

    let prompt = "";
    if (type === 'product') {
      prompt = `
        任务：听写并分析视频内容（侧重产品）。
        请返回一个 JSON 对象，包含以下两个字段：
        1. "script": 视频中的所有口播文案逐字稿（包含语气词，纯文本，**不要**带时间戳）。
        2. "analysis": 详细提取视频中的“产品名称”、“核心痛点”、“产品卖点”、“优惠机制”等关键信息。
      `;
    } else if (type === 'style') {
      // 针对 视频 B (Style) 的 Prompt
      prompt = `
        任务：深度拆解视频风格与框架（拉片分析）。
        请返回一个 JSON 对象，包含以下两个字段：
        1. "script": 视频中的所有口播文案逐字稿（**纯文本，绝对不要包含时间戳**）。
        2. "analysis": 请严格按照 Markdown 格式输出一个详细的**分镜拆解表格**和**深度分析**。
           
           analysis 字段的内容要求：
           - 必须包含“完整脚本文字汇总(原视频)”，此处仅展示纯文案。
           - 必须包含一个详细的 Markdown 表格，表头包括：| 镜号 | 景别 | 分镜时长(含时间节点) | 分镜文案 | 画面内容 | 构图方法 | 拍摄角度 | 拍摄建议 | 背景音乐 | 音效 |。
           - 在表格后，深度拆解其“叙事框架逻辑”、“黄金三秒策略”及“整体视听风格”。
      `;
    } else {
      // 针对 视频 C (Methodology) 的 Prompt
      prompt = `
        任务：提炼视频创作方法论与底层逻辑。
        请返回一个 JSON 对象，包含以下两个字段：
        1. "script": 视频文案逐字稿。
        2. "analysis": 请忽略具体产品细节，**只提炼通用的创作公式和方法论**。
           
           analysis 字段的内容要求 (Markdown格式):
           - **核心公式**: 总结该视频使用的脚本公式（例如：痛点+放大+解决方案+证明）。
           - **流量密码**: 分析该视频为何能火？（情绪钩子、反差设计、视觉奇观等）。
           - **复用指南**: 如果我要模仿这个视频，我需要遵循哪几条核心原则？
           - **适用场景**: 这种方法论适合带什么类型的货？
      `;
    }

    console.log("Sending request to Gemini...");

    // 设置超时保护
    const timeoutMs = 300000; // 5分钟
    const apiCall = ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', 
      contents: {
        parts: [
          contentPart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["script", "analysis"]
        }
      }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("请求超时：文件可能过大或网络响应慢。")), timeoutMs)
    );

    const response: any = await Promise.race([apiCall, timeoutPromise]);
    
    const rawText = response.text || "";
    console.log("Raw Response received.");
    const jsonText = cleanJsonString(rawText);
    
    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON Parse Error. Cleaned text:", jsonText);
      throw new Error("AI 返回数据格式错误，请重试。");
    }

    // Process to handle literal \n in JSON strings
    const processText = (text: string) => text ? text.replace(/\\n/g, '\n') : "";

    return {
        script: processText(result.script || "未提取到文案"),
        analysis: processText(result.analysis || "未提取到分析")
    };

  } catch (error: any) {
    console.error("Gemini Extraction Final Error:", error);
    if (error.message && error.message.includes("413")) {
         throw new Error("视频文件过大，超出了直接上传的限制。请尝试压缩视频。");
    }
    if (error.message && error.message.includes("404")) {
        throw new Error("模型调用失败 (404)：您使用的 API Key 可能不支持该模型，或模型名称配置错误。");
   }
    throw new Error(`解析失败: ${error.message || "未知错误"}`);
  }
};

export const generateFusionScript = async (data: FusionRequest): Promise<string> => {
  return "请使用 sendChatMessage 进行交互式生成。";
};

export const sendChatMessage = async (
  history: ChatMessage[], 
  newMessage: string, 
  context?: { videoA?: string, videoB?: string, videoC?: string, isFusionRequest?: boolean, isSublimationRequest?: boolean }
): Promise<string> => {
  const ai = createGeminiClient();

  // 默认 System Instruction
  let systemInstruction = SYSTEM_INSTRUCTION;

  let promptText = newMessage;
  
  if (context?.isFusionRequest) {
      // 标准融合：A (产品) + B (风格)
      promptText = `
        【任务启动：标准风格仿写】
        
        [资料A - 产品核心数据 (内容源)]
        ${context.videoA}

        [资料B - 风格与框架拆解 (模仿对象)]
        ${context.videoB}
        
        【指令】：
        请直接基于以上资料，进行风格仿写。严格参考 [资料B] 的分镜节奏，但内容替换为 [资料A] 的产品。
        
        请严格按照以下格式输出：
        【第二部分：风格仿写与脚本创作】
        **完整脚本文字汇总(新脚本- 不同文案):**
        (纯文本汇总)
        (详细分镜表格)
        
        【第三部分：背景音乐建议】
        
        【第四部分：拍摄制作指导】
      `;
  } else if (context?.isSublimationRequest) {
      // 一键升华：A (产品) + C (方法论) -> 独立优化建议
      promptText = `
        【任务启动：大师理论升华创作】
        
        [资料A - 产品核心数据]
        ${context.videoA}

        [资料C - 创作方法论 (大师理论)]
        ${context.videoC}
        
        【指令】：
        你现在的角色是【金牌脚本创作专家】。请忽略之前的风格参考，**完全基于 [资料A] 的产品卖点，并严格遵循 [资料C] 中的核心公式和流量密码（方法论）**，重新构建叙事结构，创作一条高转化率的爆款短视频脚本。

        请严格按照以下标准格式输出（保持与标准脚本生成一致的结构）：

        【第二部分：风格仿写与脚本创作】
        *说明：本脚本基于方法论C的“核心公式”进行架构，重点强化了情绪钩子与转化逻辑。*
        
        **完整脚本文字汇总(新脚本- 不同文案):**
        (此处输出基于方法论C创作的纯口播文案)

        (此处输出详细分镜表格，包含：镜号 | 景别 | 分镜时长 | 分镜文案 | 画面内容 | 构图方法 | 拍摄角度 | 拍摄建议 | 背景音乐 | 音效。**表格内容必须体现C方法论的节奏**)

        【第三部分：背景音乐建议】
        (根据 C 理论的情绪基调推荐)

        【第四部分：拍摄制作指导】
        (结合 C 理论的视觉奇观或流量密码给出的制作建议)
      `;
  }

  try {
    // 过滤掉 history 中的 error 消息，避免干扰上下文
    const validHistory = history.filter(msg => msg.role !== 'error');

    const contents = [
      ...validHistory.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user', // 确保只有 model 或 user
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user',
        parts: [{ text: promptText }]
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "无回复";
  } catch (error: any) {
    console.error("Chat Error:", error);
    throw new Error(error.message || "对话请求失败");
  }
};
