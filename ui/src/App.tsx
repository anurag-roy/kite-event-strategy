import { InformationCircleIcon } from '@heroicons/react/24/solid';
import { FormEvent } from 'react';
import instrumentOptions from '../instrumentOptions.json';
import { ComboBoxInput } from './components/ComboBoxInput';
import { NumberInput } from './components/NumberInput';

export function App() {
  const onSubmitHandler = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const submitter = (event.nativeEvent as SubmitEvent).submitter!;
    const formAction = submitter.getAttribute('formaction')!;

    const formData = new FormData(event.currentTarget);
    for (let [name, value] of Array.from(formData.entries())) {
      if (value === '') formData.delete(name);
    }
    const requestBody = Object.fromEntries(formData) as any;
    for (let [name, value] of Object.entries(requestBody)) {
      if (name !== 'stock') requestBody[name] = Number(value);
    }
    console.log('requestBody', requestBody);
    try {
      const res = await fetch(formAction, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (res.ok) {
        alert('Triggered successfully! Please check console.');
        window.location.reload();
      } else {
        alert('Some error occurred');
      }
    } catch (error) {
      console.error('Error occurred while triggering API', error);
      alert('Some error occurred');
    }
  };

  return (
    <form
      className="max-w-4xl mx-auto px-4 py-8 space-y-12"
      onSubmit={onSubmitHandler}
    >
      <div className="flex gap-12">
        <ComboBoxInput items={instrumentOptions} name="stock" />
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
          <button type="submit" formAction="/entry" className="form-button">
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
          <button type="submit" formAction="/exit" className="form-button">
            Trigger Exit Watch
          </button>
        </div>
      </div>
    </form>
  );
}
