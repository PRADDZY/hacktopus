interface KPICardProps {
  title: string;
  value: number;
  subtext: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red';
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
};

export default function KPICard({ title, value, subtext, icon, color }: KPICardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-3xl font-semibold text-gray-900">{value.toLocaleString()}</div>
        <p className="text-sm text-gray-500 mt-1">{subtext}</p>
      </div>
    </div>
  );
}
