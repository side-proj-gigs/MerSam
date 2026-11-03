import { LoadingPanel } from '@/components/ui/water-loader';

export default function LoginLoading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <LoadingPanel message="Preparing sign in" />
    </div>
  );
}
