import { useEffect, useState } from "react";
import { EDITABLE_ASSESSMENTS } from "../utils/questionBankModel";
import { loadQuestionBank, loadQuestionRequests, reviewQuestionRequest, submitQuestionRequest } from "../utils/questionBanks";

const panel = "rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6";
const input = "w-full rounded-xl border border-[#1a2438] bg-[#0b1220] p-3 text-sm text-[#e8ecf4]";
const button = "rounded-xl border border-[#1a2438] px-4 py-2 text-sm font-semibold disabled:opacity-50";
const emptyQuestion = () => ({ text: "", options: ["", ""], correctAnswerIndex: 0, explanation: "" });
const titleFor = (id) => EDITABLE_ASSESSMENTS.find((item) => item.id === id)?.title || id;

function QuestionPreview({ question }) {
  if (!question) return <p className="text-sm">No question at this position.</p>;
  return <div className="space-y-2 break-words text-sm">
    <p className="font-semibold">{question.text}</p>
    <ol className="list-inside list-[upper-alpha] space-y-1">{question.options?.map((option, index) => <li key={index}>{option}{index === question.correctAnswerIndex ? " — Correct answer" : ""}</li>)}</ol>
    <p><strong>Explanation:</strong> {question.explanation}</p>
  </div>;
}

function RequestReview({ request, busy, onReview }) {
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadQuestionBank(request.assessmentId).then((bank) => { if (active) setCurrent(bank); })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [request.assessmentId]);
  const stale = current && current.revision !== request.baseRevision;
  return <article className={panel}>
    <h3 className="text-lg font-bold">{titleFor(request.assessmentId)}</h3>
    <p className="mt-2 text-sm">Requested by: {request.requestedBy} · Base revision: {request.baseRevision}</p>
    <p className="my-3 whitespace-pre-wrap"><strong>Change summary:</strong> {request.summary}</p>
    {error && <p role="alert">{error}</p>}
    {stale && <p role="alert" className="mb-3 text-amber-500">The published bank is now revision {current.revision}. This request cannot be approved; a new request is required.</p>}
    <div className="space-y-4">{Array.from({ length: Math.max(request.before.length, request.questions.length) }, (_, index) => <details key={index} className="rounded-xl border border-[#1a2438] p-4" open>
      <summary className="cursor-pointer font-semibold">Question {index + 1}</summary>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div><h4 className="mb-2 font-bold">Base question</h4><QuestionPreview question={request.before[index]} /></div>
        <div><h4 className="mb-2 font-bold">Proposed question</h4><QuestionPreview question={request.questions[index]} /></div>
        {stale && <div className="md:col-span-2"><h4 className="mb-2 font-bold">Currently published question</h4><QuestionPreview question={current.questions[index]} /></div>}
      </div>
    </details>)}</div>
    <div className="mt-5 flex flex-wrap gap-3">
      <button className={`${button} bg-[#FFD41C] text-[#0a0e17]`} disabled={busy || !current || stale} onClick={() => onReview(request.id, true)}>Approve and publish</button>
      <button className={button} disabled={busy} onClick={() => onReview(request.id, false)}>Reject</button>
    </div>
  </article>;
}

export default function QuestionWorkspace({ mode = "faculty", user }) {
  const admin = mode === "admin";
  const [assessmentId, setAssessmentId] = useState(EDITABLE_ASSESSMENTS[0].id);
  const [bank, setBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [summary, setSummary] = useState("");
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    setLoading(true); setMessage(""); setBank(null);
    Promise.all([loadQuestionRequests(admin), admin ? Promise.resolve(null) : loadQuestionBank(assessmentId)])
      .then(([items, loaded]) => {
        if (!active) return;
        setRequests(items); setBank(loaded);
        setQuestions(loaded?.questions.length ? structuredClone(loaded.questions) : [emptyQuestion()]);
        setSummary("");
      }).catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assessmentId, admin, user?.uid, reload]);

  const edit = (index, update) => setQuestions((items) => items.map((item, i) => i === index ? { ...item, ...update } : item));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await submitQuestionRequest({ assessmentId, baseRevision: bank.revision, before: bank.questions, questions, summary });
      setSummary(""); setMessage("Submitted for approval. Published questions have not changed.");
      setRequests(await loadQuestionRequests());
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const review = async (id, approve) => {
    setBusy(true); setMessage("");
    try {
      await reviewQuestionRequest(id, approve);
      setRequests((items) => items.filter((item) => item.id !== id));
      setMessage(approve ? "Approved and published. New attempts will use this revision." : "Request rejected. Published questions have not changed.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">{admin ? "Question Approvals" : "Question Editor"}</h2>
      <button className={button} disabled={busy || loading} onClick={() => setReload((value) => value + 1)}>Refresh</button>
    </div>
    {message && <p role="status" className={panel}>{message}</p>}
    {loading ? <p>Loading questions…</p> : admin ? (
      requests.length ? requests.map((request) => <RequestReview key={request.id} request={request} busy={busy} onReview={review} />) : <p>No pending question requests.</p>
    ) : <>
      <label className="block">Assessment<select className={`${input} mt-2`} value={assessmentId} disabled={busy} onChange={(event) => setAssessmentId(event.target.value)}>{EDITABLE_ASSESSMENTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {bank && <form onSubmit={submit} className="space-y-4">
        <p className="text-sm">Published revision: {bank.revision}{bank.revision === 0 ? " · Showing the mobile app's built-in questions. Submit the complete bank for approval." : " · Submit the complete bank for administrator review."}</p>
        <fieldset disabled={busy} className="space-y-4">
          {questions.map((question, index) => <div className={panel} key={index}>
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold">Question {index + 1}</h3></div>
            <label className="block">Question text<textarea className={`${input} mt-1`} required value={question.text} onChange={(event) => edit(index, { text: event.target.value })} /></label>
            <fieldset className="my-3 space-y-2"><legend className="mb-2">Choices — select the correct answer</legend>{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2">
              <input type="radio" name={`correct-${index}`} aria-label={`Choice ${optionIndex + 1} is correct`} checked={question.correctAnswerIndex === optionIndex} onChange={() => edit(index, { correctAnswerIndex: optionIndex })} />
              <input aria-label={`Question ${index + 1}, choice ${optionIndex + 1}`} className={input} required value={option} onChange={(event) => edit(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
              <button type="button" className={button} disabled={question.options.length <= 2} aria-label={`Remove choice ${optionIndex + 1}`} onClick={() => edit(index, { options: question.options.filter((_, i) => i !== optionIndex), correctAnswerIndex: question.correctAnswerIndex === optionIndex ? 0 : question.correctAnswerIndex > optionIndex ? question.correctAnswerIndex - 1 : question.correctAnswerIndex })}>Remove</button>
            </div>)}<button type="button" className={button} disabled={question.options.length >= 4} onClick={() => edit(index, { options: [...question.options, ""] })}>Add choice</button></fieldset>
            <label className="block">Explanation<textarea className={`${input} mt-1`} required value={question.explanation} onChange={(event) => edit(index, { explanation: event.target.value })} /></label>
          </div>)}
          <label className="block">Change summary<textarea className={`${input} mt-1`} required value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
          <button className={`${button} bg-[#FFD41C] text-[#0a0e17]`} type="submit">{busy ? "Submitting…" : "Submit for approval"}</button>
        </fieldset>
      </form>}
      <div className={panel}><h3 className="mb-3 text-lg font-bold">My requests</h3>{requests.length ? <ul className="space-y-3">{requests.map((request) => <li key={request.id} className="border-b border-[#1a2438] pb-3"><strong>{titleFor(request.assessmentId)}</strong> · {request.status}<p className="whitespace-pre-wrap text-sm">{request.summary}</p></li>)}</ul> : <p>No submitted requests yet.</p>}</div>
    </>}
  </section>;
}
