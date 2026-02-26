export const formatPhoneNumber = (phone: string) => {
  if (phone.length !== 12) return phone;
  return `${phone.slice(0, 2)} (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
};
