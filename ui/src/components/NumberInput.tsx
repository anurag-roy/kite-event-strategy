import startCase from 'lodash.startcase';

type NumberInputProps = {
  name: string;
  isRequired?: boolean;
};

export function NumberInput({ name, isRequired }: NumberInputProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {startCase(name)}
      </label>
      <div className="mt-1">
        <input
          type="number"
          name={name}
          id={name}
          required={isRequired ? isRequired : undefined}
          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block sm:text-sm border-gray-300 rounded-md"
        />
      </div>
    </div>
  );
}
