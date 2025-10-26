// app/utils/enhancePrompt.ts - FIXED (no double logging, better fallback)
export type ScenePlan = {
  acts: [string, string, string];
  basePrompt: string;
};

export async function getScenePlan(rawText: string): Promise<ScenePlan> {
  const base = (rawText || "").trim();
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (!key) {
    return createManualScenes(base);
  }

  try {
    const elements = await extractSceneElements(base, key);
    console.log("✨ Extracted elements:", elements);
    
    // Create scenes WITHOUT duplicate logging
    const plan = createNaturalScenes(elements, base);
    
    // ONLY log once here
    console.log("📝 Base:", plan.basePrompt);
    console.log("🎬 Acts:", plan.acts);
    
    return plan;
  } catch (err) {
    console.error("Extraction failed:", err);
    return createManualScenes(base);
  }
}

async function extractSceneElements(raw: string, key: string): Promise<SceneElements> {
  const system = `Extract scene elements as JSON. Be specific about settings!

{
  "mainAction": "kissing" | "hugging" | "fighting" | etc,
  "mainObject": "each other" | "gorilla" | "car" | null,
  "numPeople": 1 | 2 | 3,
  "gender": "man" | "woman" | "people",
  "otherPeople": "woman" | "man" | null,
  "setting": "park" | "beach" | "forest" | "city" | "restaurant" | "bedroom" | null,
  "mood": "romantic" | "intense" | null
}

If setting not mentioned, use null (NOT "place").`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 150,
      messages: [
        { role: "system", content: system },
        { role: "user", content: raw },
      ],
    }),
  });

  if (!res.ok) throw new Error("Failed");
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  
  return {
    mainAction: parsed.mainAction || "standing with",
    mainObject: parsed.mainObject || null,
    numPeople: parsed.numPeople || 1,
    gender: parsed.gender || "person",
    otherPeople: parsed.otherPeople || null,
    setting: parsed.setting || null, // ✅ null instead of "place"
    mood: parsed.mood || null,
  };
}

type SceneElements = {
  mainAction: string;
  mainObject: string | null;
  numPeople: number;
  gender: string;
  otherPeople: string | null;
  setting: string | null;
  mood: string | null;
};

function createNaturalScenes(elements: SceneElements, userPrompt: string = ""): ScenePlan {
  const { mainAction, mainObject, numPeople, gender, otherPeople, setting } = elements;
  
  // Use better fallback for setting
  const location = setting || "romantic location";
  
  let subject = "";
  if (numPeople === 1) {
    subject = gender === "woman" ? "the woman from the picture" : "the man from the picture";
  } else if (numPeople === 2 && otherPeople) {
    if (gender === "man" && otherPeople === "woman") {
      subject = "the man and the woman from the pictures";
    } else if (gender === "woman" && otherPeople === "man") {
      subject = "the woman and the man from the pictures";
    } else {
      subject = "the people from the pictures";
    }
  } else {
    subject = "the people from the pictures";
  }
  
  let act1, act2, act3;
  
  if (mainObject && mainObject !== "each other" && mainObject !== "partner") {
    act1 = `${subject} approaching ${mainObject} at ${location}`;
    act2 = `${subject} ${mainAction} ${mainObject} at ${location}`;
    act3 = `${subject} with ${mainObject} at ${location}`;
  } else {
    act1 = `${subject} walking together at ${location}`;
    act2 = `${subject} ${mainAction} at ${location}`;
    act3 = `${subject} embracing at ${location}`;
  }
  
  return {
    basePrompt: act2,
    acts: [act1, act2, act3],
  };
}

function createManualScenes(raw: string): ScenePlan {
  const lower = raw.toLowerCase();
  
  const hasTwoPeople = lower.includes("we ") || lower.includes("couple") || 
                       (lower.includes("woman") || lower.includes("girl")) &&
                       (lower.includes("man") || lower.includes("guy"));
  
  let subject = hasTwoPeople ? "the people from the pictures" : "the person from the picture";
  
  // Better setting detection
  const setting = lower.includes("park") ? "park" :
                  lower.includes("beach") ? "beach" :
                  lower.includes("forest") ? "forest" :
                  lower.includes("city") ? "city" :
                  lower.includes("restaurant") ? "restaurant" :
                  lower.includes("bedroom") ? "bedroom" :
                  "romantic location"; // ✅ Better fallback
  
  let act1, act2, act3;
  
  if (lower.includes("hug") || lower.includes("kiss") || lower.includes("embrac")) {
    const action = lower.includes("kiss") ? "kissing" : "hugging";
    act1 = `${subject} walking together at ${setting}`;
    act2 = `${subject} ${action} at ${setting}`;
    act3 = `${subject} embracing at ${setting}`;
  }
  else if (lower.includes("fight")) {
    const target = lower.includes("gorilla") ? "gorilla" : "opponent";
    act1 = `${subject} confronting ${target} at ${setting}`;
    act2 = `${subject} fighting ${target} at ${setting}`;
    act3 = `${subject} victorious over ${target} at ${setting}`;
  }
  else {
    act1 = `${subject} arriving at ${setting}`;
    act2 = `${subject} at ${setting}`;
    act3 = `${subject} leaving ${setting}`;
  }
  
  console.log("📝 Base:", act2);
  console.log("🎬 Acts:", [act1, act2, act3]);
  
  return {
    basePrompt: act2,
    acts: [act1, act2, act3],
  };
}

export default {};