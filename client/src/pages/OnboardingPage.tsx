import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { createOrg } from '../api/org';
import { useAuth } from '../context/AuthContext';

export function OnboardingPage() {
  const { user, setOrgId } = useAuth();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [type, setType] = useState<'SCHOOL' | 'COLLEGE'>('SCHOOL');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const { org } = await createOrg({
        orgName,
        type,
        address: address || undefined,
      });
      setOrgId(org.id);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge base');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Set up your knowledge base</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tell us about your institution. You can add documents right after.
          </p>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="orgName"
              label="Institution name"
              type="text"
              placeholder="e.g. Green Valley College"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />

            <Select
              id="type"
              label="Institution type"
              value={type}
              onChange={(e) => setType(e.target.value as 'SCHOOL' | 'COLLEGE')}
              options={[
                { value: 'SCHOOL', label: 'School' },
                { value: 'COLLEGE', label: 'College' },
              ]}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                Address
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, City, State"
                rows={2}
                className="input-field resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full justify-center">
              Create knowledge base →
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Signed in as <span className="font-medium text-gray-500">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
