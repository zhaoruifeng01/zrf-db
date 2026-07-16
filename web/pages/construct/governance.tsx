import ConstructLayout from '@/new-components/layout/Construct';

function GovernancePage() {
  return (
    <ConstructLayout>
      <div className='h-[calc(100vh-56px)] w-full bg-white dark:bg-[#232734]'>
        <iframe
          title='Data Governance'
          src='/governance/'
          className='h-full w-full border-0'
          allow='clipboard-read; clipboard-write'
        />
      </div>
    </ConstructLayout>
  );
}

export default GovernancePage;
