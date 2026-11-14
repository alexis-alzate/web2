import { beatCoverUrl } from '@/lib/beats';
import { ProducerHomeView } from '../components/producer/ProducerHomeView';
import { loadActiveProducer } from './producer-data';

const RECENT_SALES = 5;

export default async function ProducerHomePage() {
  const producer = await loadActiveProducer();
  if (!producer) return null;

  return (
    <ProducerHomeView
      stageName={producer.profile.stageName}
      commissionPercent={producer.profile.commissionPercent}
      summary={producer.summary}
      beats={producer.beats.map(beat => ({ ...beat, coverUrl: beatCoverUrl(beat.coverPath) }))}
      recentSales={producer.earnings.filter(sale => sale.status !== 'cancelled').slice(0, RECENT_SALES)}
    />
  );
}
