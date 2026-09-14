import { Link } from 'react-router-dom';

type LegalKind = 'privacy' | 'terms' | 'retention' | 'contact';

const content: Record<LegalKind, { label: string; title: string; intro: string; sections: Array<[string, string]> }> = {
  privacy: {
    label: 'Privacy', title: 'Privacy at EduChat.ai', intro: 'We help schools and colleges publish answers from information they choose to share. This page explains the data we collect and why.',
    sections: [['Information we process', 'Account details, institution details, uploaded documents, chat questions, and assistant responses may be processed to provide the service.'], ['How we use it', 'We use this information to authenticate administrators, index approved institutional content, answer questions, secure the service, and improve reliability.'], ['Your control', 'Institution administrators are responsible for choosing what content is published. Contact us to request correction or deletion of account, document, or conversation data.'], ['Third parties', 'The service uses hosting, database, vector search, storage, and AI providers to operate the product. We only send the information needed for those functions.']],
  },
  terms: {
    label: 'Terms', title: 'Terms of service', intro: 'By using EduChat.ai, an institution agrees to use the service lawfully and to publish only information it has permission to share.',
    sections: [['Institution responsibility', 'Administrators must keep credentials private, review uploaded content, and ensure that published answers are appropriate for their community.'], ['Assistant limitations', 'AI answers can be incomplete or incorrect. The assistant is an information tool and does not replace official notices, staff decisions, or emergency communication.'], ['Acceptable use', 'Do not use the service to abuse the API, upload unlawful material, evade quotas, or attempt to access another institution’s data.'], ['Changes and contact', 'We may update these terms as the product develops. Questions about the service can be sent to hello@educhat.ai.']],
  },
  retention: {
    label: 'Data retention', title: 'Data retention and deletion', intro: 'We keep information only while it is needed to operate an institution’s assistant or as required for security and legal purposes.',
    sections: [['Documents and vectors', 'Uploaded documents and their searchable embeddings remain until an administrator deletes them or requests account deletion.'], ['Chat history', 'Public assistant questions and answers may be retained for the institution’s session history and service security. We will publish the final retention period before paid launch.'], ['Account data', 'Account and organization data remains while the workspace is active. Deletion requests can be made through hello@educhat.ai.'], ['Backups', 'Deleted data may remain temporarily in encrypted backups before scheduled expiration.']],
  },
  contact: {
    label: 'Contact', title: 'Talk to the EduChat.ai team', intro: 'Ask about plans, onboarding, WhatsApp availability, data deletion, or bringing EduChat to your institution.',
    sections: [['Sales and onboarding', 'Email hello@educhat.ai with your institution name, role, and what you want to launch.'], ['Privacy and deletion', 'Use the same address for privacy questions or requests to delete account, document, or conversation data.'], ['WhatsApp access', 'WhatsApp delivery is coming soon. Contact us to discuss early access and rollout requirements.'], ['Response time', 'We aim to reply within two business days.']],
  },
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const page = content[kind];
  return <div className="min-h-screen bg-[#f1f2ef] text-slate-900"><nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link to="/" className="font-bold tracking-tight">EduChat<span className="text-indigo-700">.ai</span></Link><Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Back to home</Link></nav><main className="mx-auto max-w-3xl px-6 pb-20 pt-14"><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-700">{page.label}</p><h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">{page.title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{page.intro}</p><div className="mt-12 space-y-7">{page.sections.map(([heading, text]) => <section key={heading} className="border-t border-slate-300 pt-5"><h2 className="text-lg font-bold text-slate-950">{heading}</h2><p className="mt-2 leading-7 text-slate-600">{text}</p></section>)}</div><p className="mt-12 text-xs text-slate-500">Last updated: September 15, 2026. These pages are product launch drafts and should be reviewed by qualified counsel before production use.</p></main></div>;
}
