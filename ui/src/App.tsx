import { InformationCircleIcon } from '@heroicons/react/24/solid';
import { FormEvent } from 'react';
import { ComboBoxInput } from './components/ComboBoxInput';
import { NumberInput } from './components/NumberInput';

export function App() {
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('event is ', event);
  };

  const stockNames = ['A', 'B', 'C'];

  return (
    <form
      onSubmit={handleFormSubmit}
      className="max-w-4xl mx-auto px-4 py-8 space-y-12"
    >
      <div className="flex gap-12">
        <ComboBoxInput items={stockNames} name="stock" />
        <NumberInput name="target" isRequired={true} />
        <NumberInput name="quantity" isRequired={true} />
      </div>

      <div className="bg-gray-100 rounded-md p-6">
        <div className="flex align-center gap-2 mb-4">
          <InformationCircleIcon className="w-5 h-5 inline-block text-blue-500" />
          <p className="text-blue-600 font-semibold text-sm">
            Only needed for Entry
          </p>
        </div>
        <div className="flex gap-12">
          <NumberInput name="entryPriceDifference" />
          <NumberInput name="limitPriceDifference" />
          <button type="submit" className="form-button">
            Trigger Entry Watch
          </button>
        </div>
      </div>

      <div className="bg-gray-100 rounded-md p-6">
        <div className="flex align-center gap-2 mb-4">
          <InformationCircleIcon className="w-5 h-5 inline-block text-blue-500" />
          <p className="text-blue-600 font-semibold text-sm">
            Only needed for Exit
          </p>
        </div>
        <div className="flex gap-12">
          <NumberInput name="exit" />
          <NumberInput name="exitPriceDifference" />
          <button type="submit" className="form-button">
            Trigger Exit Watch
          </button>
        </div>
      </div>
    </form>
  );
}
