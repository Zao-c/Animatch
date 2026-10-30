import { PageShell } from "@/components/PageShell";
import { SongTemplateDetail } from "@/components/anisong/SongTemplateDetail";
export default function SongTemplatePage({ params }: { params: { templateId: string } }) {
  return <PageShell><SongTemplateDetail templateId={params.templateId} /></PageShell>;
}
