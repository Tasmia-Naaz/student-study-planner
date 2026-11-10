export const DEPARTMENTS = [
  { value: 'CSE', label: 'CSE — Computer Science and Engineering' },
  { value: 'IT', label: 'IT — Information Technology' },
  { value: 'CSE (AI & ML)', label: 'CSE (AI & ML) — Computer Science and Engineering (Artificial Intelligence and Machine Learning)' },
  { value: 'CSE (AI)', label: 'CSE (AI) — Computer Science and Engineering (Artificial Intelligence)' },
  { value: 'CSE (DS)', label: 'CSE (DS) — Computer Science and Engineering (Data Science)' },
  { value: 'ECE', label: 'ECE — Electronics and Communication Engineering' },
  { value: 'EEE', label: 'EEE — Electrical and Electronics Engineering' },
  { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
  { value: 'Civil Engineering', label: 'Civil Engineering' },
  { value: 'CSIT', label: 'CSIT — Computer Science and Information Technology' },
  { value: 'Cyber Security', label: 'Cyber Security' },
  { value: 'CSE (IoT)', label: 'CSE (IoT) — Computer Science and Engineering (Internet of Things)' },
  { value: 'Other', label: 'Other' },
];

export function departmentLabel(value) {
  return DEPARTMENTS.find((department) => department.value === value)?.label || value || 'Not specified';
}
