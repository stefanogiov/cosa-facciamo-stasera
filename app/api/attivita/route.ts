import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

function getApiErrorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return typeof error.status === "number" ? error.status : undefined;
  }

  return undefined;
}

function isQuotaExceeded(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const apiError = error as { status?: unknown; code?: unknown };
  return apiError.status === 429 && apiError.code === "insufficient_quota";
}

async function withTransientRetry<T>(operation: () => Promise<T>) {
  const transientStatuses = [429, 500, 503];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = getApiErrorStatus(error);
      if (isQuotaExceeded(error) || !transientStatuses.includes(status ?? 0) || attempt === 2) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }

  throw new Error("Generazione non riuscita dopo i tentativi disponibili.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { category, group, budget, ingredients, mode } = body;
    const requestMode = mode === "recipe" ? "recipe" : "activity";

    const hasValidActivityOptions =
      typeof category === "string" &&
      category.trim() &&
      typeof group === "string" &&
      group.trim() &&
      (typeof budget === "string" || typeof budget === "number");

    if (requestMode === "activity" && !hasValidActivityOptions) {
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
    const categoryText = typeof category === "string" ? category.trim() : "";
    const groupText = typeof group === "string" ? group.trim() : "";
    const budgetText = typeof budget === "string" || typeof budget === "number" ? String(budget).trim() : "";
    const creativeSeed = Math.random().toString(36).slice(2, 8);

        const prompt = requestMode === "recipe"
      ? `Proponi una sola ricetta usando come base principale tutti e tre gli ingredienti indicati:
    - Ingredienti disponibili: ${ingredients?.map((item) => String(item).trim()).join(", ")}

    La ricetta deve essere concreta, appetitosa e realizzabile con strumenti comuni. Indica nella descrizione i passaggi essenziali in ordine, specifica una durata realistica e usa "cosa_serve" per elencare solo eventuali ingredienti di base o strumenti aggiuntivi indispensabili. Non proporre una semplice insalata o una combinazione improvvisata se puoi creare un piatto più interessante.`
      : `Proponi una sola attivita per questa richiesta:
- Categoria: ${categoryText}
- Gruppo: ${groupText}
- Budget: ${budgetText}${ingredientPrompt}

La proposta deve essere adatta al numero e al tipo di persone indicati, rispettare il budget e includere istruzioni concrete. Se sono indicati ingredienti, usali come base principale dell’idea.
Punta su una proposta varia e coerente con la richiesta: alterna esperienze culturali e di intrattenimento come cinema, teatro, mostre o concerti, attività all’aperto come picnic, passeggiate o sport, idee conviviali come cena a casa o aperitivo, e format più interattivi come laboratori, sfide a squadre, giochi investigativi o mini-competizioni. Non aggiungere elementi costosi o difficili da organizzare e non proporre sempre lo stesso tipo di attività.
    Seme creativo per questa richiesta: ${creativeSeed}. Usalo per scegliere un’angolazione diversa dalle risposte precedenti.`;
    const systemInstruction =
      "Sei un assistente brillante che propone attivita o ricette pratiche e realistiche. Rispondi sempre in italiano, con un tono ironico, giovane e leggero: fai sorridere senza diventare infantile o perdere chiarezza. Restituisci esclusivamente il JSON richiesto.";

    if (!openai) {
      throw new Error("OPENAI_API_KEY non configurata.");
    }

    const result = await withTransientRetry(() => openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "attivita_response",
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
    }));
    const content = result.choices[0]?.message.content ?? undefined;

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
    if (isQuotaExceeded(error)) {
      return NextResponse.json(
        {
          error:
            "Il servizio ha raggiunto il limite massimo di richieste disponibili per questo mese.",
        },
        { status: 429 },
      );
    }

    const isUnavailable = getApiErrorStatus(error) === 503;
    return NextResponse.json(
      {
        error: isUnavailable
          ? "Il servizio AI e temporaneamente sovraccarico. Riprova tra poco."
          : "Impossibile generare l'attivita.",
      },
      { status: isUnavailable ? 503 : 500 },
    );
  }
}