// Sample doctor data shared by the Doctors page and the appointment booking form.
export const DOCTORS = [
  { name: 'Dr. Priya Sharma', specialty: 'Cardiologist', hospital: 'Apollo Hospital', phone: '9876543210', city: 'Hyderabad' },
  { name: 'Dr. Rajesh Kumar', specialty: 'General Physician', hospital: 'Care Hospital', phone: '9876543211', city: 'Hyderabad' },
  { name: 'Dr. Anita Reddy', specialty: 'Diabetologist', hospital: 'Yashoda Hospital', phone: '9876543212', city: 'Hyderabad' },
  { name: 'Dr. Suresh Babu', specialty: 'Neurologist', hospital: 'KIMS Hospital', phone: '9876543213', city: 'Hyderabad' },
  { name: 'Dr. Meena Iyer', specialty: 'Dermatologist', hospital: 'Manipal Hospital', phone: '9876543214', city: 'Bangalore' },
  { name: 'Dr. Vikram Singh', specialty: 'Orthopedic', hospital: 'Fortis Hospital', phone: '9876543215', city: 'Delhi' },
]

export const findDoctor = (name) => DOCTORS.find(d => d.name === name) ?? null
