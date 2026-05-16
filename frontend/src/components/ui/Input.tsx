import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input: React.FC<InputProps> = ({ label, error, helperText, className = '', ...props }) => {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input
        className={`${styles.input} ${error ? styles.errorInput : ''} ${className}`}
        {...props}
      />
      {error && <span className={styles.error}>{error}</span>}
      {!error && helperText && <span className={styles.helper}>{helperText}</span>}
    </div>
  );
};

export default Input;
