import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Activity = {
  titolo: string;
  descrizione: string;
  durata_stimata: string;
  cosa_serve: string[];
};

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const activity = value as Record<string, unknown>;
  return (
    typeof activity.titolo === "string" &&
    typeof activity.descrizione === "string" &&
    typeof activity.durata_stimata === "string" &&
    Array.isArray(activity.cosa_serve) &&
    activity.cosa_serve.every((item) => typeof item === "string")
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { category, group, budget, ingredients } = body;

    if (
      typeof category !== "string" ||
      !category.trim() ||
      typeof group !== "string" ||
      !group.trim() ||
      (typeof budget !== "string" && typeof budget !== "number")
    ) {
      return NextResponse.json(
        { error: "category, group e budget sono obbligatori." },
        { status: 400 },
      );
    }

    if (ingredients !== undefined && (!Array.isArray(ingredients) || ingredients.length !== 3 || ingredients.some((item) => typeof item !== "string" || !item.trim()))) {
      return NextResponse.json(
        { error: "Inserisci esattamente 3 ingredienti validi." },
        { status: 400 },
      );
    }

    const ingredientPrompt = Array.isArray(ingredients)
      ? `
- Ingredienti disponibili: ${ingredients.map((item) => String(item).trim()).join(", ")}`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "attivita",
          strict: true,
          schema: {
            type: "object",
            properties: {
              titolo: { type: "string" },
              descrizione: { type: "string" },
              durata_stimata: { type: "string" },
              cosa_serve: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "titolo",
              "descrizione",
              "durata_stimata",
              "cosa_serve",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente brillante che propone attivita pratiche e realistiche. Rispondi sempre in italiano, con un tono ironico, giovane e leggero: fai sorridere senza diventare infantile o perdere chiarezza. Restituisci esclusivamente il JSON richiesto.",
        },
        {
          role: "user",
          content: `Proponi una sola attivita per questa richiesta:
- Categoria: ${category.trim()}
- Gruppo: ${group.trim()}
- Budget: ${String(budget).trim()}${ingredientPrompt}

La proposta deve essere adatta al numero e al tipo di persone indicati, rispettare il budget e includere istruzioni concrete. Se sono indicati ingredienti, usali come base principale dell'idea.`,
        },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      return NextResponse.json(
        { error: "Il modello non ha restituito una proposta." },
        { status: 502 },
      );
    }

    const activity: unknown = JSON.parse(content);
    if (!isActivity(activity)) {
      return NextResponse.json(
        { error: "La risposta del modello non ha il formato atteso." },
        { status: 502 },
      );
    }

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Errore nella generazione dell'attivita:", error);
    return NextResponse.json(
      { error: "Impossibile generare l'attivita." },
      { status: 500 },
    );
  }
}