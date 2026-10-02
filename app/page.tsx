'use client';

import { useState } from 'react';

function Icon({ symbol }: { symbol: string }) {
  return <span aria-hidden="true">{symbol}</span>;
}

interface IdeaResult {
  titolo: string;
  descrizione: string;
  durata_stimata: string;
  cosa_serve: string[];
}

function isIdeaResult(value: unknown): value is IdeaResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const idea = value as Record<string, unknown>;
  return (
    typeof idea.titolo === 'string' &&
    typeof idea.descrizione === 'string' &&
    typeof idea.durata_stimata === 'string' &&
    Array.isArray(idea.cosa_serve) &&
    idea.cosa_serve.every((item) => typeof item === 'string')
  );
}

const optionClass = (selected: boolean, compact = false) =>
  `flex items-center justify-center rounded-xl border py-3 font-medium transition-all ${
    compact ? 'gap-1 px-1.5 text-xs sm:gap-2 sm:px-4 sm:text-sm' : 'gap-2 px-4' 
  } ${
    selected
      ? 'border-amber-400 bg-amber-400/15 text-amber-200 shadow-lg shadow-amber-950/30'
      : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
  }`;

export default function HomePage() {
  const [mode, setMode] = useState<'mood' | 'ricette'>('mood');
  const [category, setCategory] = useState<'casa' | 'fuori'>('casa');
  const [group, setGroup] = useState<'solo' | 'coppia' | 'amici'>('coppia');
  const [budget, setBudget] = useState<'gratis' | 'economico' | 'top'>('gratis');
  const [ingredients, setIngredients] = useState(['', '', '']);
  const [result, setResult] = useState<IdeaResult | null>(null);
  const [history, setHistory] = useState<IdeaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    const cleanedIngredients = ingredients.map((ingredient) => ingredient.trim()).filter(Boolean);
    if (mode === 'ricette' && cleanedIngredients.length !== 3) {
      setError('Inserisci esattamente 3 ingredienti.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/attivita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          group,
          ...(mode === 'mood' ? { budget } : {}),
          mode: mode === 'ricette' ? 'recipe' : 'activity',
          ingredients: mode === 'ricette' ? cleanedIngredients : undefined,
        }),
      });
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        // Gestisce risposte vuote o non JSON restituite dal server.
      }

      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Errore del server (${response.status}).`;
        throw new Error(message);
      }

      if (!isIdeaResult(data)) {
        throw new Error('Il server ha restituito una risposta non valida.');
      }

      const idea = data;
      setResult(idea);
      setHistory((previousHistory) => [idea, ...previousHistory].slice(0, 3));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Si e verificato un errore durante la generazione.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(
      `Stasera facciamo: ${result.titolo}\n${result.descrizione}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#10151b] px-5 py-8 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
              <Icon symbol="✦" />
            </span>
            <span className="text-sm font-semibold tracking-[0.18em] text-amber-200 uppercase">
              Stasera
            </span>
          </div>
        </header>

        <section className="grid flex-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-amber-300 uppercase">
              Idee senza discussioni infinite
            </p>
            <h1 className="max-w-xl text-5xl leading-[0.95] font-semibold tracking-tight text-white sm:text-6xl">
              Cosa facciamo stasera?
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              Scegli il tuo mood e lascia che una buona idea prenda forma.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="space-y-7">
              <div className="grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/50 p-1" role="tablist" aria-label="Modalita di generazione">
                <button type="button" role="tab" aria-selected={mode === 'mood'} onClick={() => setMode('mood')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'mood' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}>Scegli il mood</button>
                <button type="button" role="tab" aria-selected={mode === 'ricette'} onClick={() => setMode('ricette')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'ricette' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}>Svuota-frigo</button>
              </div>

              {mode === 'mood' ? <>
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-200">Dove vuoi stare?</legend>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCategory('casa')} className={optionClass(category === 'casa')}><Icon symbol="⌂" /> A casa</button>
                  <button type="button" onClick={() => setCategory('fuori')} className={optionClass(category === 'fuori')}><Icon symbol="↗" /> Fuori</button>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-200">Con chi sei?</legend>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setGroup('solo')} className={optionClass(group === 'solo')}><Icon symbol="●" /> Solo</button>
                  <button type="button" onClick={() => setGroup('coppia')} className={optionClass(group === 'coppia')}><Icon symbol="♡" /> Coppia</button>
                  <button type="button" onClick={() => setGroup('amici')} className={optionClass(group === 'amici')}><Icon symbol="••" /> Amici</button>
                </div>
              </fieldset>
              </> : (
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-slate-200">Scegli 3 ingredienti</legend>
                  <div className="space-y-3">
                    {ingredients.map((ingredient, index) => (
                      <input
                        key={index}
                        type="text"
                        value={ingredient}
                        onChange={(event) => setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                        placeholder={`Ingrediente ${index + 1}`}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-400"
                      />
                    ))}
                  </div>
                </fieldset>
              )}

              {mode === 'mood' && (
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-slate-200">Budget</legend>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setBudget('gratis')} className={optionClass(budget === 'gratis', true)}><Icon symbol="○" /> Gratis</button>
                    <button type="button" onClick={() => setBudget('economico')} className={optionClass(budget === 'economico', true)}><Icon symbol="▣" /> Economico</button>
                    <button type="button" onClick={() => setBudget('top')} className={optionClass(budget === 'top', true)}><Icon symbol="€" /> Top</button>
                  </div>
                </fieldset>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-amber-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? <span className="animate-spin">↻</span> : <Icon symbol="✦" />}
                {loading ? (mode === 'ricette' ? 'Creo la ricetta...' : 'Generazione idea...') : (mode === 'ricette' ? 'Genera ricetta' : 'Sorprendimi!')}
              </button>
            </div>

            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

            {result && (
              <article className="mt-8 border-t border-slate-800 pt-7">
                <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-amber-300 uppercase">La proposta</p>
                <h2 className="text-3xl font-semibold text-white">{result.titolo}</h2>
                <p className="mt-3 leading-7 text-slate-300">{result.descrizione}</p>
                <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <p className="rounded-lg bg-slate-800/70 px-3 py-2">⏱ {result.durata_stimata}</p>
                  <p className="rounded-lg bg-slate-800/70 px-3 py-2">🎒 {result.cosa_serve.join(', ')}</p>
                </div>
                <button type="button" onClick={handleShare} className="mt-5 flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200">
                  {copied ? <Icon symbol="✓" /> : <Icon symbol="↗" />}
                  {copied ? 'Copiato negli appunti' : 'Condividi'}
                </button>
              </article>
            )}

            {history.length > 0 && (
              <section className="mt-8 border-t border-slate-800 pt-7" aria-labelledby="history-title">
                <p id="history-title" className="mb-3 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Ultime idee</p>
                <ul className="space-y-2">
                  {history.map((idea, index) => (
                    <li key={`${idea.titolo}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                      <span className="truncate text-slate-300">{idea.titolo}</span>
                      <span className="shrink-0 text-xs text-slate-500">{idea.durata_stimata}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}