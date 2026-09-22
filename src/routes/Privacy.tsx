export default function Privacy() {
  return (
    <article className="container page">
      <div className="page-head">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy</h1>
        <p>Kept is a hackathon prototype. This page describes what it actually does with your data.</p>
      </div>
      <div className="prose">
      <h2>What Kept stores</h2>
      <p>
        Evidence you upload or forward to your Kept address (emails, attachments, bills), public pages you ask Kept to capture, the terms
        extracted from them, and the case messages you approve. Files are stored in Convex file storage and are only readable through your
        signed-in account.
      </p>
      <h2>Services that process your data</h2>
      <ul>
        <li>Convex: database, file storage, authentication, and hosting.</li>
        <li>OpenAI: reads the evidence you provide to extract terms and draft case emails. Requests are sent with storage disabled.</li>
        <li>Firecrawl: fetches public web pages you ask Kept to capture.</li>
        <li>AgentMail: your Kept inbox, forwarded messages, and support emails you approve.</li>
      </ul>
      <h2>Email</h2>
      <p>Kept processes the contents and attachments of emails you forward. Support messages are sent only after you click Send.</p>
      <h2>Not legal advice</h2>
      <p>Kept compares evidence. It doesn’t provide legal advice or determine what a company owes you.</p>
      <h2>Deletion</h2>
      <p>
        You can delete a protected item, which removes its sources, files, extracted terms, observations, and cases from Kept. Copies already
        held by the services above follow their own retention policies, which Kept can’t override.
      </p>
      </div>
    </article>
  );
}
