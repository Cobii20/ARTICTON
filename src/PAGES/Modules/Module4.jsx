export default function Module4Page({ onBack }) {
  return (
    <div className="min-h-screen bg-[#061E29] text-white flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-6">Module 4: Configuring Software</h1>

      <button
        onClick={onBack}
        className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm font-semibold"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
