import { PageShell } from "@/components/PageShell";
import { SongTemplateDetail } from "@/components/anisong/SongTemplateDetail";
export default function SongTemplatePage({ params }: { params: { templateId: string } }) {
  return <PageShell><SongTemplateDetail key={params.templateId} templateId={params.templateId} /></PageShell>;
}
