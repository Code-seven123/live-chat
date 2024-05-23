import nodemailer from "nodemailer"
import { config } from "dotenv"
import otpGenerator from "otp-generator"
config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_EMAIL,
    pass: process.env.MAIL_PASS
  }
});

// Fungsi untuk mengirim kode OTP
const sendOTP = (email) => {
  // Generate OTP
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: true, specialChars: false }).toUpperCase()

  // Kirim email
  transporter.sendMail({
    from: process.env.MAIL_EMAIL,
    to: email,
    subject: 'OTP Verification',
    text: `Your OTP (One-Time Password) is: ${otp}`
  }, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });

  return otp; // Kembalikan OTP untuk disimpan dan diverifikasi
};

export default sendOTP
