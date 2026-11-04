import { GitCompareArrows, Link2 } from 'lucide-react';
import { api } from '../../api/api';
import { useApi } from '../../state/useApi';
import { ErrorState, Loading } from '../ui/States';
import { ContradictionCard } from './ContradictionCard';
import { LinkList, Section } from './NodeDetailView';
import { RecordCard } from './RecordCard';

export function RecordDetailView({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi(() => api.getRecord(id), [id]);
  if (loading) return <Loading label="Opening record" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <div className="space-y-6 p-5">
      <RecordCard record={data.record} expanded />
      {data.contradictions.length > 0 && (
        <Section title="Disagrees with" icon={<GitCompareArrows className="h-4 w-4" />}>
          <div className="space-y-3">
            {data.contradictions.map((c) => (
              <ContradictionCard key={c.id} c={c} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Linked items" icon={<Link2 className="h-4 w-4" />}>
        {data.linkedNodes.length ? <LinkList links={data.linkedNodes} /> : <p className="text-sm text-ink-muted">Not linked to any item on the graph.</p>}
      </Section>
    </div>
  );
}
