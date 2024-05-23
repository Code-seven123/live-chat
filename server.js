import { Router } from "express"
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ioClient from 'socket.io-client'
import { checkSchema, validationResult } from "express-validator"
import { hashPass, verifHash } from "./lib/hasing.js"
import User from "./database/User-model.js"
import { Op } from "sequelize"
import sendOTP from "./lib/mailer.js"
const socketChat = ioClient("http://127.0.0.1:3000/chat")
const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url));

function isEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function logged(id, args1, password){
  const log = `${id}.${hashPass(args1)}.${hashPass(password)}`
  return log
}
async function checkLogged(log){
  if(log == undefined || log == null) return false
  try {
    const parse = log?.split(".")
    const { dataValues: result } = await User.findOne({ where: { id: parse[0] } })
    if(result == null || result == undefined){
      return false
    } else if(verifHash(result?.username, parse[1]) || verifHash(result?.email, parse[1]) && (parse[2] == result?.password)) {
      return true
    } else {
      console.log("error")
    }
  } catch(e) {
    return false
  }
}
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Failed logout');
    }
    res.redirect("/")
  })
})
router.get("/", (req, res) => {
  res.render("home")
})
router.get("/chat", async (req, res) => {
  const logged = await checkLogged(req.session.logged)
  if(!logged){
    res.redirect('/login')
  } else {
    res.render("index")
  }
})

router.get("/login", async (req, res) => {
  const logged = await checkLogged(req.session.logged)
  if(logged){
    res.redirect('/chat')
  } else {
    res.render("login", { error: req?.query?.error || false })
  }
})
const loginSchema = {
  username: {
        custom: {
            options: (value) => {
                // Periksa apakah input adalah email atau username
                const isEmail = /^\S+@\S+\.\S+$/.test(value);
                const isUsername = value.length > 0; // Panjang username tidak terbatas
                if (!isEmail && !isUsername) {
                    throw new Error('Username must be a valid email or a non-empty string');
                }
                return true;
            },
            errorMessage: 'Invalid username or email'
        }
    }
}
router.post("/ceklogin", checkSchema(loginSchema), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const param = new URLSearchParams({ error: errors.array().map(err => err.msg) })
    return res.redirect("/login?"+param.toString())
  }
  const userOrEmail = req.body.username
  const index = (isEmail(userOrEmail)) ? { email: userOrEmail } : { username: userOrEmail }
  const password = req.body.password
  const result = await User.findOne({ where: index })
  if(result?.verified == false) {
    const params = new URLSearchParams({ id: result?.id+'.'+hashPass(userOrEmail) })
    res.redirect("/verifikasi?"+params.toString())
  } else if(verifHash(password, result?.password)){
    req.session.logged = logged(result?.id, userOrEmail, password)
    res.redirect("/chat")
  } else {
    const param = new URLSearchParams({ error: "email or password failed" })
    res.redirect(`/login?${param.toString()}`)
  }
})
const regisSchema = {
  email: {
    isEmail: {
      errorMessage: "please enter valid email"
    },
    normalizeEmail: true
  }
}
router.post("/cekregis", checkSchema(regisSchema), async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const param = new URLSearchParams({ error: errors.array().map(err => err.msg) })
    return res.redirect("/regis?"+param.toString())
  }
  const email = req.body.email
  const username = req.body.username
  const hashPassword = hashPass(req.body.password)
  const result = await User.findOne({
    where: {
      [Op.or]: [
        { username: username },
        { email: email }
      ]
    }
  })
  if(result){
    const param = new URLSearchParams({ error: "email or username already exist" })
    return res.redirect("/regis?"+param.toString())
  } else {
    const newUser = await User.create({
      email: email,
      username: username,
      password: hashPassword,
    });
    await newUser.save()
    try {
      const { dataValues: newData } = newUser
      req.session.logged = logged(newData?.id, email || username, req.body.password)
      const param = new URLSearchParams({ id: newData?.id+'.'+hashPass(username || email) })
      res.redirect("/verifikasi?"+param.toString())
    } catch(e) {
      const param = new URLSearchParams({ error: "you can login and verif" })
      res.redirect("/regis?"+param.toString())
      console.error(e)
    }
  }
})
router.get("/regis", async (req, res) => {
  const logged = await checkLogged(req.session.logged)
  if(logged){
    res.redirect('/chat')
  } else {
    res.render("signup", { error: req?.query?.error || false })
  }
})
router.get("/verifikasi", async ( req, res ) => {
  if(req?.query?.id == undefined || req?.query?.id == null){
    res.redirect("/")
  } else {
    const id = req?.query?.id?.split(".")
    const data = await User.findOne({ where: { id: id[0] } })
    if(req.session.otp == null || req?.session?.otp == undefined) {
      const otp = sendOTP(data?.email)
      req.session.otp = otp
      res.render("otp", { id: req?.query?.id })
    } else {
      res.render("otp", { id: req?.query?.id })
    }
  }
})
router.post("/validate", async (req, res) => {
  if(req?.body?.otp == undefined){
    res.redirect("/verifikasi?" + new URLSearchParams({ id: req?.body?.id }))
  } else if(req?.body?.otp == req?.session?.otp){
    const id = req?.body?.id?.split(".")[0]
    const data = await User.update({ verified: true }, {
      where: { id: id }
    })
    console.log(data)
    if(data?.affectedRows > 0){
      delete req?.session?.otp
      res.redirect("/")
    } else {
      res.redirect("/verifikasi?" + new URLSearchParams({ id: req?.body?.id }))
    }
  }
})
router.get("/resend", async (req, res) => {
  const logged = await checkLogged(req.session.logged)
  const data = await User.findOne({ where: {  id: req?.query?.id?.split(".")[0] } })
  const otp = sendOTP(data?.email)
  req.session.otp = otp
  const param = new URLSearchParams({ id: req?.query?.id })
  res.redirect("/verifikasi?"+param.toString())
})

router.get("/reset", async (req, res) => {
  const logged = await checkLogged(req.session.logged)
  if(logged){
    res.redirect("/")
  } else {
    res.render("reset", { error: req?.query?.error || false })
  }
})
router.post("/resetSend", async (req, res) => {
  const userOrEmail = req.body.email
  const index = (isEmail(userOrEmail)) ? { email: userOrEmail } : { username: userOrEmail }
  const data = await User.findOne({ where: index })
  if(data !== null){
    const otp = sendOTP(data?.email)
    req.session.resetOtp = otp
    res.json({ status: true })
  } else {
    res.json({ status: false })
  }
})

const updateSchema = {
  otp: {
    in: ['body'],
    isLength: {
      options: { min: 6, max: 6 },
      errorMessage: 'OTP must be exactly 6 characters long',
    },
  },
  username: {
    in: ['body'],
    isEmail: {
      errorMessage: 'Invalid email address',
    },
  },
}

router.post("/update", checkSchema(updateSchema), async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const param = new URLSearchParams({ error: errors.array().map(err => err.msg) })
    return res.redirect("/reset?"+param.toString())
  }
  const email = req.body.username
  const otp = req.body.otp
  const password = req.body.password
  const data = await User.findOne({ where: { email: email } })
  if(data == null){
    const param = new URLSearchParams({ error: "user not found" })
    return res.redirect("/reset?"+param.toString())
  } else {
    if(otp == req.session.resetOtp){
      if(verifHash(password, data?.password)) {
        if(req.body.yes == "true"){
          const [ affectedRows ] = await User.update({ password: hashPass(password) }, { where: { id: data?.id } })
          if(affectedRows > 0){
            req.session.logged = logged(data?.id, email, req.body.password)
            delete req.session.resetOtp
            res.redirect("/chat")
          } else {
            const param = new URLSearchParams({ error: "error updated data" })
            return res.redirect("/reset?"+param.toString())
          }
        } else {
          const param = new URLSearchParams({ error: "The password cannot be the same." })
          return res.redirect("/reset?"+param.toString())
        }
      } else {
        const param = new URLSearchParams({ error: "cancel from user" })
        return res.redirect("/reset?"+param.toString())
      }
    } else {
      const param = new URLSearchParams({ error: "otp not matched" })
      return res.redirect("/reset?"+param.toString())
    }
  }
})
router.get('/robots.txt', (req, res) => {
  res.sendFile(join(__dirname, "src/robots.txt"));
});

export default router
