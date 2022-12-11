import React, { useState } from "react";

function AddRequestHeaderForm(props) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    props.addHeader(name, value);
    setName('');
    setValue('');
  }


  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleValueChange(e) {
    setValue(e.target.value);
  }

  function handle(e) {
    setValue(e.target.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="label-wrapper">
        <label htmlFor="new-request-header-input" className="label__lg">
          New Request Header
        </label>
      </h2>
      <input
        type="text"
        id="new-request-header-input"
        className="input input__lg"
        name="text"
        placeholder="Header Name"
        autoComplete="off"
        value={name}
        onChange={handleNameChange}
      />
      <input
        type="text"
        id="new-request-header-input-value"
        className="input input__lg"
        name="text"
        placeholder="Header Value"
        autoComplete="off"
        value={value}
        onChange={handleValueChange}
      />
      <button type="submit" className="btn btn__primary btn__lg">
        Add
      </button>
    </form>
  );
}

export default AddRequestHeaderForm;
