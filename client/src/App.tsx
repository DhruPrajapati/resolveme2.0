import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:3000/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <div>
      <h1>ResolveMe</h1>
      <p>Server status: {status ?? "checking..."}</p>
    </div>
  );
}

export default App;
