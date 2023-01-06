import React, { useState } from "react";

function AddRequestHeaderForm(props) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [overrideType, setOverrideType] = useState('header');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    props.addHeader(name, value, overrideType);
    setName('');
    setValue('');
    setOverrideType('header');
  }


  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleValueChange(e) {
    setValue(e.target.value);
  }

  function handleRequestOverrideTypeChange(e) {
    setOverrideType(e.target.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="label-wrapper">
        <label htmlFor="new-request-header-input" className="label__lg">
          New Request Header/Query Param
        </label>
      </h2>
      <input
        type="text"
        id="new-request-header-input"
        className="input input__lg"
        name="text"
        placeholder="Header/Query Param Name"
        autoComplete="off"
        value={name}
        onChange={handleNameChange}
      />
      <input
        type="text"
        id="new-request-header-input-value"
        className="input input__lg"
        name="text"
        placeholder="Header/Query Param Value"
        autoComplete="off"
        value={value}
        onChange={handleValueChange}
      />
      <div>
        <label className="input label__radio input__radio">
          <input onChange={handleRequestOverrideTypeChange} type="radio" value="header" name="overrideType" checked={overrideType === "header"} /> Header Param
        </label>
        <label className="input label__radio input__radio">
          <input onChange={handleRequestOverrideTypeChange} type="radio" value="requestQueryParam" name="overrideType" checked={overrideType === "requestQueryParam"} /> Request Query Param
        </label>
      </div>
      <button type="submit" className="btn btn__primary btn__lg">
        Add
      </button>
    </form>
  );
}

export default AddRequestHeaderForm;
