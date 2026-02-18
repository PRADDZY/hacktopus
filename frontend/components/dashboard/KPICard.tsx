interface KPICardProps {
  title: string;
  value: number;
  subtext: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red';
}

const colorClasses = {
  blue: 'bg-ink/5 text-ink',
  green: 'bg-highlight/10 text-highlight',
  amber: 'bg-accent/10 text-accent',
  red: 'bg-rose-100 text-rose-700',
};

export default function KPICard({ title, value, subtext, icon, color }: KPICardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-3xl font-semibold text-ink">{value.toLocaleString()}</div>
        <p className="text-sm text-muted mt-1">{subtext}</p>
      </div>
    </div>
  );
}
