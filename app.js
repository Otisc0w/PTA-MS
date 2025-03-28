const express = require("express");
const path = require("path");
const multer = require("multer");
const hbs = require("hbs");
const session = require("express-session"); // Import express-session
const app = express();
const moment = require('moment');

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const asyncfuncs = require("./asyncfuncs");

const port = process.env.PORT || 8080;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
exports.supabase = supabase;

// Register handlebars partials directory
hbs.registerPartials(path.join(__dirname, 'views/partials'));

hbs.registerHelper('json', function (context) {
  return JSON.stringify(context, null, 2);
});

// Middleware to parse JaSON
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded data
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.use(asyncfuncs.fetchNotifications);
app.use(asyncfuncs.fetchUserData);
app.use(asyncfuncs.checkAndExpireNCCRegistrations);
app.use(asyncfuncs.checkAndExpireInstructorRegistrations);
app.use(asyncfuncs.checkUpcomingEvents);



// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

hbs.registerHelper("reverseEach", function (context, options) {
  let out = "";
  for (let i = context.length - 1; i >= 0; i--) {
    out += options.fn(context[i]);
  }
  return out;
});
hbs.registerHelper("eq", function (a, b) {
  return a === b;
});
hbs.registerHelper("me", function (a, b) {
  return a >= b;
});
hbs.registerHelper("le", function (a, b) {
  return a <= b;
});
hbs.registerHelper("ne", function (a, b) {
  return a !== b;
});
hbs.handlebars.registerHelper("or", function (a, b) {
  return a || b;
});
hbs.handlebars.registerHelper('orray', function (a, b) {
  return a || (Array.isArray(b) && b.length > 0);
});
hbs.handlebars.registerHelper("and", function (a, b) {
  return a && b;
});
hbs.registerHelper("3ands", function (a, b, c) {
  return a && b && c;
});
hbs.registerHelper("arraySize", function (array) {
  return array.length;
});
hbs.registerHelper('ordinal', function (number) {
  if (number === null || number === undefined) {
    return 'N/A';
  }
  const suffixes = ["th", "st", "nd", "rd"];
  const v = number % 100;
  return number + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
});
hbs.registerHelper("renderComments", function (comments, options) {
  function renderNestedComments(comments, parentId) {
    let out = "<ul>";
    comments
      .filter((comment) => comment.parentid === parentId)
      .forEach((comment) => {
        out += "<li>" + options.fn(comment);
        const childComments = comments.filter((c) => c.parentid === comment.id);
        if (childComments.length) {
          out += renderNestedComments(comments, comment.id);
        }
        out += "</li>";
      });
    out += "</ul>";
    return out;
  }

  return renderNestedComments(comments, null);
});
hbs.registerHelper("formatStatus", function (status) {
  switch (status) {
    case 1:
      return '<span class="status-under-review">Under Review</span>';
    case 2:
      return '<span class="status-en-route">En-route to Regional Office</span>';
    case 3:
      return '<span class="status-shipped">ID Shipped</span>';
    case 4:
      return '<span class="status-rejected">Rejected</span>';
    case 5:
      return '<span class="status-expired">Expired</span>';
    case 6:
      return '<span class="status-rejected">Suspended</span>';
    default:
      return '<span class="status-unknown">Unknown Status</span>';
      
  }
});
hbs.registerHelper('formatDate', function (date, format) {
  return moment(date).format(format);
});
hbs.registerHelper('formatCreatedAt', function (created_at) {
  return moment(created_at).format('MMM D h:mm A');
});
hbs.registerHelper('formatTime', function (time, format) {
  return moment(time, 'HH:mm:ss').format(format);
});
hbs.registerHelper('isBefore', function (date1, date2, options) {
  if (moment(date1).isBefore(moment(date2))) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});
hbs.registerHelper('map', function (array, options) {
  return array.map(item => options.fn(item)).join('');
});
hbs.registerHelper('formatMoney', function (amount) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
});
hbs.registerHelper('yearsSince', function (date) {
  const now = moment();
  const pastDate = moment(date);
  return now.diff(pastDate, 'years');
});
hbs.registerHelper('some', function(array, value, options) {
  if (array.includes(value)) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});
hbs.registerHelper("contains", function (array, value, options) {
  if (array && array.map(String).includes(String(value))) {
    return options.fn(this); // Render the block if condition is true
  } else {
    return options.inverse(this); // Render the else block if condition is false
  }
});
hbs.registerHelper("not", function (value) {
  return !value;
});

app.use( session({
    secret: "your_secret_key", // Replace with a secure secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Set up Handlebars view engine
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Route to fetch and display data on the index page
app.get("/", async (req, res) => {
  try {
    // Fetch users data
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*");

    if (usersError) {
      return res.status(400).json({ error: usersError.message });
    }

    // Fetch athletes data
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select("*");

    if (athletesError) {
      return res.status(400).json({ error: athletesError.message });
    }

    console.log("Fetched users data:", users); // Log the users data to the console
    console.log("Fetched athletes data:", athletes); // Log the athletes data to the console

    // Render the index.hbs template with the fetched data
    res.render("index", { users, athletes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example route to get a specific row from Supabase and log it
app.get("/data/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single(); // single() ensures we get a single row

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SUBMIT STUFF
app.post("/submit-login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single(); // Ensure a single match

    if (error || !data) {
      // Invalid credentials
      return res.status(401).render("index", {
        error: "Invalid username or password.",
        users: [], // Pass users array if needed
        athletes: [], // Pass athletes array if needed
      });
    }

    // Store user in session
    req.session.user = {
      id: data.id,
      firstname: data.firstname,
      middlename: data.middlename,
      lastname: data.lastname,
      username: data.username,
      email: data.email,
      password: data.password,
      club: data.club,
      region: data.region,
      profilepic: data.profilepic,
      athleteverified: data.athleteverified,
      instructorverified: data.instructorverified,
      ptaverified: data.ptaverified,
    };
    // Successful login
    res.redirect("/home");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-signup", async (req, res) => {
  const {
    username,
    firstname,
    middlename = "",
    lastname,
    email,
    password,
  } = req.body; // Capture user input from the form

  const athleteverified = false;
  const instructorverified = false;
  const ptaverified = false;

  try {
    const { data: existingUsers, error: existingUsersError } = await supabase
      .from("users")
      .select("username, email")
      .or(`username.eq.${username},email.eq.${email}`);

    if (existingUsersError) {
      // Handle any errors that occur during the select
      return res.status(500).render("index", {
        error: "Error checking existing users.",
        users: [], // Optionally pass users array if you need it in the view
      });
    }

    if (existingUsers.length > 0) {
      return res.redirect("/?signup=failed");
    }

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          email,
          firstname,
          middlename,
          lastname,
          password,
          athleteverified,
          instructorverified,
          ptaverified,
        },
      ]);

    if (error) {
      return res.status(500).render("index", {
        error: "Error creating user.",
        users: [], // Optionally pass users array if you need it in the view
      });
    }

    res.redirect("/");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-ncc", upload.fields([
    { name: "birthcert", maxCount: 1 },
    { name: "portrait", maxCount: 1 },
    { name: "paymentproof", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      firstname,
      middlename,
      lastname,
      gender,
      bday,
      age,
      phonenum,
      email,
      lastpromo,
      promolocation,
      clubregion,
      beltlevel,
      instructorfirstname,
      instructormi,
      instructorlastname,
      instructormobile,
      instructoremail,
    } = req.body; // Capture user input from the form

    if (!req.session.user) {
      return res.status(401).send("Unauthorized: No user logged in");
    }

    const submittedby = req.session.user.id; // Get the current user's username from the session
    const status = 1;

    let birthcertUrl = null;
    let portraitUrl = null;
    let paymentproofUrl = null;

    if (req.files) {
      try {
        if (req.files.birthcert) {
          const birthcertPath = `documents/${Date.now()}-${
            req.files.birthcert[0].originalname
          }`;
          const { error: birthcertUploadError } = await supabase.storage
            .from("documents")
            .upload(birthcertPath, req.files.birthcert[0].buffer, {
              contentType: req.files.birthcert[0].mimetype,
            });

          if (birthcertUploadError) {
            console.error(
              "Error uploading birth certificate:",
              birthcertUploadError.message
            );
            return res.status(500).send("Error uploading birth certificate");
          }

          birthcertUrl = `${supabaseUrl}/storage/v1/object/public/documents/${birthcertPath}`;
        }

        if (req.files.portrait) {
          const portraitPath = `documents/${Date.now()}-${
            req.files.portrait[0].originalname
          }`;
          const { error: portraitUploadError } = await supabase.storage
            .from("documents")
            .upload(portraitPath, req.files.portrait[0].buffer, {
              contentType: req.files.portrait[0].mimetype,
            });

          if (portraitUploadError) {
            console.error(
              "Error uploading portrait:",
              portraitUploadError.message
            );
            return res.status(500).send("Error uploading portrait");
          }

          portraitUrl = `${supabaseUrl}/storage/v1/object/public/documents/${portraitPath}`;
        }

        if (req.files.paymentproof) {
          const paymentproofPath = `documents/${Date.now()}-${
            req.files.paymentproof[0].originalname
          }`;
          const { error: paymentproofUploadError } = await supabase.storage
            .from("documents")
            .upload(paymentproofPath, req.files.paymentproof[0].buffer, {
              contentType: req.files.paymentproof[0].mimetype,
            });

          if (paymentproofUploadError) {
            console.error(
              "Error uploading paymentproof:",
              paymentproofUploadError.message
            );
            return res.status(500).send("Error uploading paymentproof");
          }

          paymentproofUrl = `${supabaseUrl}/storage/v1/object/public/documents/${paymentproofPath}`;
        }
      } catch (error) {
        console.error("Server error during file upload:", error.message);
        return res.status(500).json({ error: error.message });
      }
    }

    try {
      // Check if a row with the same submittedby already exists
      const { data: existingRegistration, error: existingRegistrationError } = await supabase
        .from("ncc_registrations")
        .select("*")
        .eq("submittedby", submittedby)
        .single();

      if (existingRegistrationError && existingRegistrationError.code !== 'PGRST116') {
        console.error("Error checking existing registration:", existingRegistrationError.message);
        return res.status(500).render("membership", {
          error: "Error checking existing registration.",
          users: [], // Optionally pass users array if you need it in the view
        });
      }

      if (existingRegistration) {
        // Update the existing registration
        const { data, error } = await supabase
          .from("ncc_registrations")
          .update({
            firstname,
            middlename,
            lastname,
            gender,
            bday,
            age,
            phonenum,
            email,
            lastpromo,
            promolocation,
            clubregion,
            beltlevel,
            instructorfirstname,
            instructormi,
            instructorlastname,
            instructormobile,
            instructoremail,
            status,
            expireson: null,
            birthcert: birthcertUrl || existingRegistration.birthcert, // Use existing URL if no new file
            portrait: portraitUrl || existingRegistration.portrait, // Use existing URL if no new file
            paymentproof: paymentproofUrl || existingRegistration.paymentproof, // Use existing URL if no new file
          })
          .eq("submittedby", submittedby);

        if (error) {
          console.error("Error updating registration:", error.message);
          return res.status(500).render("membership", {
            error: "Error updating registration.",
            users: [], // Optionally pass users array if you need it in the view
          });
        }
      } else {
        // Insert a new registration
        const { data, error } = await supabase.from("ncc_registrations")
        .insert([
          {
            firstname,
            middlename,
            lastname,
            gender,
            bday,
            age,
            phonenum,
            email,
            lastpromo,
            promolocation,
            clubregion,
            beltlevel,
            instructorfirstname,
            instructormi,
            instructorlastname,
            instructormobile,
            instructoremail,
            status,
            submittedby,
            birthcert: birthcertUrl, // Include the birth certificate URL
            portrait: portraitUrl, // Include the portrait URL
            paymentproof: paymentproofUrl, // Include the payment proof URL
          },
        ]);

        if (error) {
          console.error("Error creating registration:", error.message);
          return res.status(500).render("membership", {
            error: "Error creating registration.",
            users: [], // Optionally pass users array if you need it in the view
          });
        }
      }

      // Add a notification for the user about their NCC registration submission
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            userid: submittedby,
            type: "Registration",
            message: "Your NCC registration has been successfully submitted.",
            desc: "Your NCC registration has been successfully submitted and is now awaiting review. You will receive notifications for the status of your application.",
          },
        ]);

      if (notificationError) {
        console.error("Error creating notification:", notificationError.message);
        return res.status(500).send("Error creating notification");
      }

      // Add a notification for PTA verified users about the new NCC registration submission
      const { data: ptaUsers, error: ptaUsersError } = await supabase
        .from("users")
        .select("id")
        .eq("ptaverified", true);

      if (ptaUsersError) {
        console.error("Error fetching PTA verified users:", ptaUsersError.message);
        return res.status(500).send("Error fetching PTA verified users");
      }

      const notifications = ptaUsers.map(user => ({
        userid: user.id,
        type: "Registration",
        message: "A new NCC registration has been submitted.",
        desc: "A new NCC registration has been submitted and is now awaiting review.",
      }));

      const { error: ptaNotificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (ptaNotificationError) {
        console.error("Error creating notifications for PTA verified users:", ptaNotificationError.message);
        return res.status(500).send("Error creating notifications for PTA verified users");
      }

      res.redirect("/membership-status");
    } catch (error) {
      console.error("Server error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post("/submit-instructor", upload.fields([
  { name: "birthcert", maxCount: 1 },
  { name: "portrait", maxCount: 1 },
  { name: "educproof", maxCount: 1 },
  { name: "poomsaecert", maxCount: 1 },
  { name: "kukkiwoncert", maxCount: 1 },
  { name: "ptablackbeltcert", maxCount: 1 },
  { name: "paymentproof", maxCount: 1 },
  ]),
  async (req, res) => {
  const {
    firstname,
    middlename,
    lastname,
    gender,
    bday,
    phonenum,
    email,
    clubprovince,
  } = req.body; // Capture user input from the form

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const submittedby = req.session.user.id; // Get the current user's username from the session
  const status = 1;

  let birthcertUrl = null;
  let portraitUrl = null;
  let educproofUrl = null;
  let poomsaecertUrl = null;
  let kukkiwoncertUrl = null;
  let ptablackbeltcertUrl = null;
  let paymentproofUrl = null;

  if (req.files) {
    try {
    if (req.files.birthcert) {
      const birthcertPath = `documents/${Date.now()}-${
        req.files.birthcert[0].originalname
      }`;
      const { error: birthcertUploadError } = await supabase.storage
        .from("documents")
        .upload(birthcertPath, req.files.birthcert[0].buffer, {
          contentType: req.files.birthcert[0].mimetype,
        });

      if (birthcertUploadError) {
        console.error(
          "Error uploading birth certificate:",
          birthcertUploadError.message
        );
      } else {
        birthcertUrl = `${supabaseUrl}/storage/v1/object/public/documents/${birthcertPath}`;
      }
    }

    if (req.files.portrait) {
      const portraitPath = `documents/${Date.now()}-${
        req.files.portrait[0].originalname
      }`;
      const { error: portraitUploadError } = await supabase.storage
        .from("documents")
        .upload(portraitPath, req.files.portrait[0].buffer, {
          contentType: req.files.portrait[0].mimetype,
        });

      if (portraitUploadError) {
        console.error(
          "Error uploading portrait:",
          portraitUploadError.message
        );
      } else {
        portraitUrl = `${supabaseUrl}/storage/v1/object/public/documents/${portraitPath}`;
      }
    }

    if (req.files.educproof) {
      const educproofPath = `documents/${Date.now()}-${
        req.files.educproof[0].originalname
      }`;
      const { error: educproofUploadError } = await supabase.storage
        .from("documents")
        .upload(educproofPath, req.files.educproof[0].buffer, {
          contentType: req.files.educproof[0].mimetype,
        });

      if (educproofUploadError) {
        console.error(
          "Error uploading educproof:",
          educproofUploadError.message
        );
      } else {
        educproofUrl = `${supabaseUrl}/storage/v1/object/public/documents/${educproofPath}`;
      }
    }

    if (req.files.poomsaecert) {
      const poomsaecertPath = `documents/${Date.now()}-${
        req.files.poomsaecert[0].originalname
      }`;
      const { error: poomsaecertUploadError } = await supabase.storage
        .from("documents")
        .upload(poomsaecertPath, req.files.poomsaecert[0].buffer, {
          contentType: req.files.poomsaecert[0].mimetype,
        });

      if (poomsaecertUploadError) {
        console.error(
          "Error uploading poomsaecert:",
          poomsaecertUploadError.message
        );
      } else {
        poomsaecertUrl = `${supabaseUrl}/storage/v1/object/public/documents/${poomsaecertPath}`;
      }
    }

    if (req.files.kukkiwoncert) {
      const kukkiwoncertPath = `documents/${Date.now()}-${
        req.files.kukkiwoncert[0].originalname
      }`;
      const { error: kukkiwoncertUploadError } = await supabase.storage
        .from("documents")
        .upload(kukkiwoncertPath, req.files.kukkiwoncert[0].buffer, {
          contentType: req.files.kukkiwoncert[0].mimetype,
        });

      if (kukkiwoncertUploadError) {
        console.error(
          "Error uploading kukkiwoncert:",
          kukkiwoncertUploadError.message
        );
      } else {
        kukkiwoncertUrl = `${supabaseUrl}/storage/v1/object/public/documents/${kukkiwoncertPath}`;
      }
    }

    if (req.files.ptablackbeltcert) {
      const ptablackbeltcertPath = `documents/${Date.now()}-${
        req.files.ptablackbeltcert[0].originalname
      }`;
      const { error: ptablackbeltcertUploadError } = await supabase.storage
        .from("documents")
        .upload(
          ptablackbeltcertPath,
          req.files.ptablackbeltcert[0].buffer,
          {
            contentType: req.files.ptablackbeltcert[0].mimetype,
          }
        );

      if (ptablackbeltcertUploadError) {
        console.error(
          "Error uploading ptablackbeltcert:",
          ptablackbeltcertUploadError.message
        );
      } else {
        ptablackbeltcertUrl = `${supabaseUrl}/storage/v1/object/public/documents/${ptablackbeltcertPath}`;
      }
    }

    if (req.files.paymentproof) {
      const paymentproofPath = `documents/${Date.now()}-${
        req.files.paymentproof[0].originalname
      }`;
      const { error: paymentproofUploadError } = await supabase.storage
        .from("documents")
        .upload(
          paymentproofPath,
          req.files.paymentproof[0].buffer,
          {
            contentType: req.files.paymentproof[0].mimetype,
          }
        );

      if (paymentproofUploadError) {
        console.error(
          "Error uploading paymentproof:",
          paymentproofUploadError.message
        );
      } else {
        paymentproofUrl = `${supabaseUrl}/storage/v1/object/public/documents/${paymentproofPath}`;
      }
    }
    } catch (error) {
    console.error("Server error during file upload:", error.message);
    return res.status(500).json({ error: error.message });
    }
  }

  try {
    // Check if a row with the same submittedby already exists
    const { data: existingRegistration, error: existingRegistrationError } = await supabase
    .from("instructor_registrations")
    .select("*")
    .eq("submittedby", submittedby)
    .single();

    if (existingRegistrationError && existingRegistrationError.code !== 'PGRST116') {
    console.error("Error checking existing registration:", existingRegistrationError.message);
    return res.status(500).render("membership", {
      error: "Error checking existing registration.",
      users: [], // Optionally pass users array if you need it in the view
    });
    }

    if (existingRegistration) {
    // Update the existing registration
    const { data, error } = await supabase
      .from("instructor_registrations")
      .update({
      firstname,
      middlename,
      lastname,
      gender,
      bday,
      phonenum,
      email,
      clubprovince,
      status,
      birthcert: birthcertUrl || existingRegistration.birthcert, // Use existing URL if no new file
      portrait: portraitUrl || existingRegistration.portrait, // Use existing URL if no new file
      educproof: educproofUrl || existingRegistration.educproof, // Use existing URL if no new file
      poomsaecert: poomsaecertUrl || existingRegistration.poomsaecert, // Use existing URL if no new file
      kukkiwoncert: kukkiwoncertUrl || existingRegistration.kukkiwoncert, // Use existing URL if no new file
      ptablackbeltcert: ptablackbeltcertUrl || existingRegistration.ptablackbeltcert, // Use existing URL if no new file
      paymentproof: paymentproofUrl || existingRegistration.paymentproof, // Use existing URL if no new file
      })
      .eq("submittedby", submittedby);

    if (error) {
      console.error("Error updating registration:", error.message);
      return res.status(500).render("membership", {
      error: "Error updating registration.",
      users: [], // Optionally pass users array if you need it in the view
      });
    }
    } else {
    // Insert a new registration
    const { data, error } = await supabase
      .from("instructor_registrations")
      .insert([
      {
        firstname,
        middlename,
        lastname,
        gender,
        bday,
        phonenum,
        email,
        clubprovince,
        status,
        submittedby,
        birthcert: birthcertUrl, // Include the birth certificate URL
        portrait: portraitUrl, // Include the portrait URL
        educproof: educproofUrl,
        poomsaecert: poomsaecertUrl,
        kukkiwoncert: kukkiwoncertUrl,
        ptablackbeltcert: ptablackbeltcertUrl,
        paymentproof: paymentproofUrl, // Include the payment proof URL
      },
      ]);

    if (error) {
      console.error("Error creating registration:", error.message);
      return res.status(500).render("membership", {
      error: "Error creating registration.",
      users: [], // Optionally pass users array if you need it in the view
      });
    }
    }

    // Add a notification for the user about their Instructor registration submission
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: submittedby,
          type: "Registration",
          message: "Your Instructor registration has been successfully submitted.",
          desc: "Your Instructor registration has been successfully submitted and is now awaiting review. You will receive notifications for the status of your application.",
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    // Add a notification for PTA verified users about the new Instructor registration submission
    const { data: ptaUsers, error: ptaUsersError } = await supabase
      .from("users")
      .select("id")
      .eq("ptaverified", true);

    if (ptaUsersError) {
      console.error("Error fetching PTA verified users:", ptaUsersError.message);
      return res.status(500).send("Error fetching PTA verified users");
    }

    const notifications = ptaUsers.map(user => ({
      userid: user.id,
      type: "Registration",
      message: "A new Instructor registration has been submitted.",
      desc: "A new Instructor registration has been submitted and is now awaiting review.",
    }));

    const { error: ptaNotificationError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (ptaNotificationError) {
      console.error("Error creating notifications for PTA verified users:", ptaNotificationError.message);
      return res.status(500).send("Error creating notifications for PTA verified users");
    }

    res.redirect("/membership-status");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
  }
);

app.post("/create-post", async (req, res) => {
  const { title, topicid, body, profilepic } = req.body; // Capture user input from the form

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const originalposter = req.session.user.username; // Get the current user's id from the session
  const upvotes = [],
    downvotes = [];

  try {
    // Fetch the topic from the forum_topics table using the topicid
    const { data: topicData, error: topicError } = await supabase
      .from("forum_topics")
      .select("topic")
      .eq("id", topicid)
      .single();

    if (topicError) {
      // Handle any errors that occur during the topic fetch
      console.error("Error fetching topic:", topicError.message);
      return res.status(500).send("Error fetching topic");
    }

    const topic = topicData.topic; // Extract the topic value

    // Insert the new forum thread into the forum_threads table
    const { data, error } = await supabase.from("forum_threads").insert([
      {
        title,
        originalposter,
        topic,
        topicid,
        body,
        upvotes,
        downvotes,
        profilepic,
      },
    ]);

    if (error) {
      // Handle any errors that occur during the insert
      console.error("Error creating post:", error.message);
      return res.status(500).render("forum", {
        error: "Error creating post.",
        users: [], // Optionally pass users array if you need it in the view
      });
    }

    res.redirect("/forum");
  } catch (error) {
    // Handle any server-side errors
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-topic", async (req, res) => {
  const { topic } = req.body; // Capture user input from the form

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Update the user in the database
    const { data, error } = await supabase.from("forum_topics").insert([
      {
        topic,
      },
    ]);

    if (error) {
      // Handle any errors that occur during the update
      return res.status(500).render("forum", {
        error: "Error updating profile.",
        users: [], // Optionally pass users array if you need it in the view
      });
    }

    res.redirect("/forum");
  } catch (error) {
    // Handle any server-side errors
    res.status(500).json({ error: error.message });
  }
});

app.post('/forum/update-post', async (req, res) => {
  try {
    // Log the form data for debugging purposes
    console.log("Form data:", req.body);

    // Extract fields from request body
    const { title, topic, body, threadId } = req.body;  // Ensure threadId is passed in the form

    // Perform the update in the database
    const { data, error } = await supabase
      .from('forum_threads')  // Replace with your actual table name
      .update({
        title: title,
        topic: topic,
        body: body,
      })
      .eq('id', threadId);  // Make sure this is the correct field

    if (error) {
      console.error("Error updating post:", error.message);
      return res.status(500).render("forum", {
        error: "Error updating post.",
        thread: {},  // Optionally, pass the thread object to show current data if needed
      });
    }

    // Redirect to the forum after successful update
    res.redirect(`/forum`);
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).render("forum", {
      error: "An unexpected error occurred.",
    });
  }
});

app.post('/forum/delete-post', async (req, res) => {
  const { threadId } = req.body;  // Get the post ID from the form body

  console.log("Deleting post with threadId:", threadId);  // Log the threadId for debugging

  try {
    const { data, error } = await supabase
      .from('forum_threads')  // Replace 'forum_threads' with your actual table name
      .delete()
      .eq('id', threadId);  // Match the post by ID

    if (error) {
      return res.status(500).json({ success: false, error: 'Error deleting post' });
    }

    res.redirect(`/forum`);  // Redirect to the forum after deleting the post
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/forum-thread/update-post', async (req, res) => {
  try {
    // Extract the necessary fields from the request body
    const { title, topic, body } = req.body;
    const threadId = req.body.threadId; // Assuming you pass the threadId to identify which post to update
    
    // Update the post in the database
    const { data, error } = await supabase
      .from('forum_threads') // Replace 'threads' with your actual table name if different
      .update({
        title: title,
        topic:topic,
        body: body,
      })
      .eq('id', threadId); // Ensure the correct id is used in the eq method

    if (error) {
      console.error("Error updating post:", error.message);
      return res.status(500).render("forum-thread", {
        error: "Error updating post.",
        thread: {}, // Optionally pass the thread object to show current data if needed
      });
    }

    // Redirect or render success view
    res.redirect(`/forum-thread/${threadId}`);
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).render("forum-thread", {
      error: "An unexpected error occurred.",
    });
  }
});

app.post('/forum-thread/delete-post', async (req, res) => {
  const {threadId} = req.body; // Get the post ID from the form body

  try {
    // Delete the post from your database (adjust according to your database setup)
    const { data, error } = await supabase
      .from('forum_threads')  // Replace 'forum_threads' with your actual table name
      .delete()
      .eq('id', threadId);  // Match the post by ID

    if (error) {
      return res.status(500).json({ success: false, error: 'Error deleting post' });
    }

    res.redirect(`/forum`); // Redirect to the forum after deleting the post
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post("/delete-notification/:id", async (req, res) => {
  const { id } = req.params;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userid = req.session.user.id;

  try {
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("userid", userid);

    if (error) {
      console.error("Error deleting notification:", error.message);
      return res.status(500).send("Error deleting notification");
    }

    res.redirect("/notifications");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/delete-all-notifications", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userid = req.session.user.id;

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("userid", userid);

    if (error) {
      console.error("Error deleting notifications:", error.message);
      return res.status(500).send("Error deleting notifications");
    }

    res.redirect("/notifications");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/save-profile-changes", upload.single("file"), async (req, res) => {
  const {
    firstname,
    middlename,
    lastname,
    username,
    email,
    password,
    region,
    athleteverified,
    instructorverified,
    ptaverified,
  } = req.body; // Capture user input from the form

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const id = req.session.user.id; // Get the current user's id from the session
  let profilepic = req.session.user.profilepic;

  if (req.file) {
    try {
      const filePath = `profilepics/${Date.now()}-${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("profilepics")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        console.error("Error uploading profile picture:", uploadError.message);
        return res.status(500).send("Error uploading profile picture");
      }

      profilepic = `${supabaseUrl}/storage/v1/object/public/profilepics/${filePath}`;
    } catch (error) {
      console.error("Server error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  try {
    // Update the user in the database
    const { data, error } = await supabase
      .from("users") // Replace 'users' with your actual table name if different
      .update({
        firstname,
        middlename,
        lastname,
        username,
        email,
        password,
        region,
        athleteverified,
        instructorverified,
        profilepic,
      })
      .eq("id", id); // Ensure the correct id is used in the eq method

    if (error) {
      console.error("Error updating profile:", error.message);
      return res.status(500).render("home", {
        error: "Error updating profile.",
        users: [], // Optionally pass users array if you need it in the view
      });
    }

    // Update the session with the new user data if needed
    req.session.user = {
      ...req.session.user,
      firstname,
      middlename,
      lastname,
      email,
      profilepic,
    };

    console.log("Profile updated successfully for user:", id);

    res.redirect("/profile");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const id = req.session.user.id;

  try {
    // Validate current password (implementation depends on how passwords are stored)
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (userError || !user || user.password !== currentPassword) {
      return res.status(401).send("Incorrect current password");
    }

    // Update the user's password in the database
    const { data, error } = await supabase
      .from("users")
      .update({
        password: newPassword,
      })
      .eq("id", id);

    if (error) {
      console.error("Error changing password:", error.message);
      return res.status(500).send("Error changing password");
    }

    res.status(200).send("Password changed successfully");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-nccstatus", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { applicationId, status } = req.body; // Capture application ID and new status from the form
  let expireson = new Date();
  expireson.setFullYear(expireson.getFullYear() + 1);

  try {
    // Update the status of the specific registration in the database
    const { data: registration, error: updateStatusError } = await supabase
      .from("ncc_registrations")
      .update({ status })
      .eq("id", applicationId)
      .select("*")
      .single(); // Fetch the updated registration to get the submittedby value

    if (updateStatusError) {
      console.error("Error updating status:", updateStatusError.message);
      return res.status(500).send("Error updating status");
    }

    if (!registration) {
      return res.status(404).send("Registration not found");
    }

    // Add a notification for the user about their registration status
    let statusMessage;
    const statusInt = parseInt(status, 10);

    switch (statusInt) {
      case 1:
        statusMessage = "Your NCC registration is under review.";
        statusDesc = "Your NCC registration is under review. You will receive a notification once your registration has been processed.";
        break;
      case 2:
        statusMessage = "Your NCC ID is en route to your regional office.";
        statusDesc = "Your NCC ID is on its way to your regional office. You will be notified once it arrives.";
        break;
      case 3:
        statusMessage = "Your NCC ID is now ready for pickup at your regional office.";
        statusDesc = "Your NCC ID is ready for pickup at your regional office. Please visit the office to collect it.";
        break;
      case 4:
        statusMessage = "Your NCC registration has been rejected.";
        statusDesc = "Sorry, your NCC registration has been rejected. Please check your membership status for more information.";
        break;
      case 6:
        statusMessage = "Your NCC registration has been suspended.";
        statusDesc = "Sorry, your NCC registration has been rejected. Please check the reason for your suspension in your membership status.";
        break;
      default:
        statusMessage = "Unknown status.";
        statusDesc = "The status of your NCC registration is unknown. Please contact support for more information.";
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: registration.submittedby,
          type: "Registration",
          message: statusMessage,
          desc: statusDesc,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    console.log("Registration updated:", registration);

    if (status == 1) {
      const { error: updateAthleteVerifiedError } = await supabase
        .from("users")
        .update({ athleteverified: false })
        .eq("id", registration.submittedby);

      if (updateAthleteVerifiedError) {
        console.error("Error updating athleteverified:", updateAthleteVerifiedError.message);
        return res.status(500).send("Error updating athleteverified");
      }
    }

    if (status == 6) {
      const { suspendmsg, susdescription } = req.body; // Capture the reject message from the form

      // Update the suspendmsg column
      const { error: updatesuspendmsgError } = await supabase
      .from("ncc_registrations")
      .update({ suspendmsg: suspendmsg, susdescription: susdescription })
      .eq("id", applicationId);

      if (updatesuspendmsgError) {
      console.error("Error updating suspendmsg:", updatesuspendmsgError.message);
      return res.status(500).send("Error updating suspendmsg");
      }

      const { error: updateAthleteVerifiedError } = await supabase
      .from("users")
      .update({ athleteverified: false })
      .eq("id", registration.submittedby);

      if (updateAthleteVerifiedError) {
      console.error("Error updating athleteverified:", updateAthleteVerifiedError.message);
      return res.status(500).send("Error updating athleteverified");
      }

      // Remove any event registrations of the player
      const { error: removeEventRegistrationsError } = await supabase
      .from("events_registrations")
      .delete()
      .eq("userid", registration.submittedby);

      if (removeEventRegistrationsError) {
      console.error("Error removing event registrations:", removeEventRegistrationsError.message);
      return res.status(500).send("Error removing event registrations");
      }
    }

    // Check if status is 4, indicating the need to update the rejectmsg
    if (status == 4) {
      const { 
        rejectmsg,
        description,
        portrait,
        firstname,
        middlename,
        lastname,
        gender,
        bday,
        phonenum,
        email,
        lastpromo,
        promolocation,
        clubregion,
        beltlevel,
        instructorfirstname,
        instructormi,
        instructorlastname,
        instructormobile,
        instructoremail,
        birthcert,
        paymentproof,
      } = req.body; // Capture the reject message from the form

      const bdayValue = bday ? bday : null;
      const lastpromoValue = lastpromo ? lastpromo : null;
      // Update the rejectmsg column
      const { error: updateRejectMsgError } = await supabase
        .from("ncc_registrations")
        .update({
          rejectmsg: rejectmsg,
          description: description,
          portrait,
          firstname,
          middlename,
          lastname,
          gender,
          bday: bdayValue,
          phonenum,
          email,
          lastpromo: lastpromoValue,
          promolocation,
          clubregion,
          beltlevel,
          instructorfirstname,
          instructormi,
          instructorlastname,
          instructormobile,
          instructoremail,
          birthcert,
          paymentproof,
        })
        .eq("id", applicationId);

      if (updateRejectMsgError) {
        console.error("Error updating rejectmsg:", updateRejectMsgError.message);
        return res.status(500).send("Error updating rejectmsg");
      }
    }

    // Check if status is 3, indicating the need to update the user's athleteverified column and insert into athletes table
    if (status == 3) {
      const {
        firstname,
        middlename,
        lastname,
        gender,
        bday,
        clubregion,
        beltlevel,
        portrait,
        height,
        weight,
        submittedby,
        instructorfirstname,
        instructorlastname,
        age,
        lastpromo
      } = registration;

      // console.log("Updating user with ID:", submittedby);

      // // Update the corresponding user's registered column to true
      // const { data: user, error: updateUserError } = await supabase
      //   .from("users")
      //   .eq("id", submittedby)
      //   .select("*")
      //   .single();

      // if (updateUserError) {
      //   console.error("Error updating user:", updateUserError.message);
      //   return res.status(500).send("Error updating user");
      // }

      // // // Update the expireson column
      // const { error: updateExpiresOnError } = await supabase
      //   .from("ncc_registrations")
      //   .update({ expireson })
      //   .eq("id", applicationId);

      // if (updateExpiresOnError) {
      //   console.error("Error updating expireson:", updateExpiresOnError.message);
      //   return res.status(500).send("Error updating expireson");
      // }

      // console.log("User updated:", user);
      // const name = `${firstname} ${middlename} ${lastname}`;
      // const instructor = `${instructorfirstname} ${instructorlastname}`;

      // const userid = submittedby;

      // let division;
      // if (age >= 10 && age <= 11) {
      //   division = "Youth";
      // } else if (age >= 12 && age <= 14) {
      //   division = "Cadet";
      // } else if (age >= 15 && age <= 17) {
      //   division = "Junior";
      // } else if (age >= 18 && age <= 32) {
      //   division = "Senior";
      // } else if (age >= 33) {
      //   division = "Ultra";
      // } else {
      //   division = "Unknown";
      // }

      // // Check if the athlete already exists
      // const { data: existingAthlete, error: fetchAthleteError } = await supabase
      //   .from("athletes")
      //   .select("*")
      //   .eq("userid", userid)
      //   .single();

      // if (fetchAthleteError && fetchAthleteError.code !== 'PGRST116') {
      //   console.error("Error fetching athlete:", fetchAthleteError.message);
      //   return res.status(500).send("Error fetching athlete");
      // }

      // if (existingAthlete) {
      //   // Update the existing athlete
      //   const { error: updateAthleteError } = await supabase
      //     .from("athletes")
      //     .update({
      //       name,
      //       gender,
      //       bday,
      //       clubregion,
      //       beltlevel,
      //       portrait,
      //       agedivision: division,
      //       height,
      //       weight,
      //       instructor,
      //       age,
      //       lastpromo
      //     })
      //     .eq("userid", userid);

      //   if (updateAthleteError) {
      //     console.error("Error updating athlete:", updateAthleteError.message);
      //     return res.status(500).send("Error updating athlete");
      //   }

      //   console.log("Athlete updated successfully");
      // } else {
      //   // Insert the new athlete
      //   const { error: insertAthleteError } = await supabase
      //     .from("athletes")
      //     .insert([
      //       {
      //         name,
      //         gender,
      //         bday,
      //         clubregion,
      //         beltlevel,
      //         portrait,
      //         agedivision: division,
      //         height,
      //         weight,
      //         instructor,
      //         userid,
      //         age,
      //         lastpromo
      //       },
      //     ]);

      //   if (insertAthleteError) {
      //     console.error("Error inserting athlete:", insertAthleteError.message);
      //     return res.status(500).send("Error inserting athlete");
      //   }

      //   console.log("Athlete inserted successfully");
      // }
      

      // const { error: transactionError } = await supabase
      //   .from("transactions")
      //   .insert([
      //     {
      //       name: user.firstname + " " + user.lastname,
      //       userid: registration.submittedby,
      //       type: "NCC",
      //       amount: 500, // Adjust the amount as needed
      //     },
      //   ]);

      // if (transactionError) {
      //   console.error("Error creating transaction:", transactionError.message);
      //   return res.status(500).send("Error creating transaction");
      // }

      // Store athlete data in session
      req.session.athlete = {
        firstname,
        middlename,
        lastname,
        gender,
        bday,
        clubregion,
        beltlevel,
        portrait,
        // division,
        height,
        weight,
      };
    }

    res.redirect(`/membership-review/${applicationId}`); // Redirect back to the review page
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/activate-ncc-membership", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { applicationId } = req.body; // Capture application ID from the form
  let expireson = new Date();
  expireson.setFullYear(expireson.getFullYear() + 1);

  try {
    // Update the status of the specific registration in the database
    const { data: registration, error: updateStatusError } = await supabase
      .from("ncc_registrations")
      .update({ expireson })
      .eq("id", applicationId)
      .select("*")
      .single(); // Fetch the updated registration to get the submittedby value

    if (updateStatusError) {
      console.error("Error activating membership:", updateStatusError.message);
      return res.status(500).send("Error activating membership");
    }

    if (!registration) {
      return res.status(404).send("Registration not found");
    }

    // Update the user's athleteverified column to true
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ athleteverified: true })
      .eq("id", registration.submittedby);

    if (updateUserError) {
      console.error("Error updating user:", updateUserError.message);
      return res.status(500).send("Error updating user");
    }

    // Add a notification for the user about their membership activation
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: registration.submittedby,
          type: "Membership",
          message: "Your NCC membership has been activated.",
          desc: "Congratulations! Your NCC membership is now active. Please check your membership status for details.",
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    res.redirect(`/membership-review/${applicationId}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/reject-ncc-fields", async (req, res) => {

  const {
    id,
    portrait,
    firstname,
    middlename,
    lastname,
    gender,
    bday,
    phonenum,
    email,
    lastpromo,
    promolocation,
    clubregion,
    beltlevel,
    instructorfirstname,
    instructormi,
    instructorlastname,
    instructormobile,
    instructoremail,
    birthcert,
    paymentproof,
  } = req.body;

  const bdayValue = bday ? bday : null;
  const lastpromoValue = lastpromo ? lastpromo : null;

  try {
    const { data, error } = await supabase
      .from("ncc_registrations")
      .update(
        { portrait,
          firstname,
          middlename,
          lastname,
          gender,
          bday: bdayValue,
          phonenum,
          email,
          lastpromo: lastpromoValue,
          promolocation,
          clubregion,
          beltlevel,
          instructorfirstname,
          instructormi,
          instructorlastname,
          instructormobile,
          instructoremail,
          birthcert,
          paymentproof,
         }
      )
      .eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.redirect(`/membership-review/${id}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/reject-instructor-fields", async (req, res) => {
  const {
    instructorregid,
    rejectmsg,
    rejectdescription,
    firstname,
    middlename,
    lastname,
    gender,
    bday,
    phonenum,
    email,
    clubregion,
    birthcert,
    portrait,
    educproof,
    poomsaecert,
    kukkiwoncert,
    ptablackbeltcert,
    paymentproof,
    validpayment,
  } = req.body;

  const bdayValue = bday ? bday : null;

  try {
    // Update the registration with the reject message and description
    const { error: updateRegistrationError } = await supabase
      .from("instructor_registrations")
      .update({
        rejectmsg,
        rejectdescription,
        firstname,
        middlename,
        lastname,
        gender,
        bday: bdayValue,
        phonenum,
        email,
        clubregion,
        birthcert,
        portrait,
        educproof,
        poomsaecert,
        kukkiwoncert,
        ptablackbeltcert,
        paymentproof,
        validpayment
      })
      .eq("id", instructorregid);

    if (updateRegistrationError) {
      console.error("Error updating registration:", updateRegistrationError.message);
      return res.status(500).send("Error updating registration");
    }

    // Redirect back to the review page
    res.redirect(`/instructor-review/${instructorregid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/reject-club-fields", async (req, res) => {
  const {
    clubregid,
    firstname,
    lastname,
    phonenum,
    email,
    clubname,
    clubaddress,
    province,
    idfile,
    proofdoc,
    clubpic,
    paymentproof,
    rejectmsg,
    rejectdescription,
  } = req.body;

  try {
    const { data, error } = await supabase
      .from("club_registrations")
      .update(
        {
          firstname,
          lastname,
          phonenum,
          email,
          clubname,
          clubaddress,
          province,
          idfile,
          proofdoc,
          clubpic,
          paymentproof,
          rejectmsg,
          rejectdescription,
        }
      )
      .eq("id", clubregid);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { error: updateStatusError } = await supabase
      .from("club_registrations")
      .update({ status: 4 })
      .eq("id", clubregid);

    if (updateStatusError) {
      return res.status(400).json({ error: updateStatusError.message });
    }

    res.redirect(`/clubreg-review/${clubregid}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-instructorstatus", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  let expireson = new Date();
  expireson.setFullYear(expireson.getFullYear() + 1);
  const { applicationId, status } = req.body; // Capture application ID and new status from the form

  try {
    // Update the status of the specific registration in the database
    const { data: registration, error: updateStatusError } = await supabase
      .from("instructor_registrations")
      .update({ status })
      .eq("id", applicationId)
      .select("*")
      .single(); // Fetch the updated registration to get the submittedby value

    if (updateStatusError) {
      console.error("Error updating status:", updateStatusError.message);
      return res.status(500).send("Error updating status");
    }

    console.log("Registration updated:", registration);

    // Add a notification for the user about their registration status
    let statusMessage;
    const statusInt = parseInt(status, 10);

    switch (statusInt) {
      case 1:
      statusMessage = "Your Instructor registration is under review.";
      statusDesc = "Your Instructor registration is under review. You will receive a notification once your registration has been processed.";
      break;
          case 2:
      statusMessage = "Your Instructor's License is en route to your regional office.";
      statusDesc = "Your Instructor's License is on its way to your regional office. You will be notified once it arrives.";
      break;
          case 3:
      statusMessage = "Your Instructor's License is now ready for pickup at your regional office.";
      statusDesc = "Your Instructor's License is ready for pickup at your regional office. Please visit the office to collect it.";
      break;
          case 4:
      statusMessage = "Your Instructor registration has been rejected.";
      statusDesc = "Sorry, your Instructor registration has been rejected. Please contact support for more information.";
      break;
          case 6:
      statusMessage = "Your Instructor registration has been suspended.";
      statusDesc = "Sorry, your Instructor registration has been suspended. Please check the reason for your suspension in your membership status.";
      break;
          default:
      statusMessage = "Unknown status.";
      statusDesc = "The status of your Instructor registration is unknown. Please contact support for more information.";
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: registration.submittedby,
          type: "Registration",
          message: statusMessage,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    if (status == 1) {
      const { error: updateInstructorVerifiedError } = await supabase
      .from("users")
      .update({ instructorverified: false })
      .eq("id", registration.submittedby);

      if (updateInstructorVerifiedError) {
      console.error("Error updating instructorverified:", updateInstructorVerifiedError.message);
      return res.status(500).send("Error updating instructorverified");
      }
    }

    if (status == 6) {
      const { suspendmsg, susdescription } = req.body; // Capture the suspend message from the form

      // Update the suspendmsg column
      const { error: updatesuspendmsgError } = await supabase
      .from("instructor_registrations")
      .update({ suspendmsg: suspendmsg, susdescription: susdescription })
      .eq("id", applicationId);

      if (updatesuspendmsgError) {
      console.error("Error updating suspendmsg:", updatesuspendmsgError.message);
      return res.status(500).send("Error updating suspendmsg");
      }

      const { error: updateInstructorVerifiedError } = await supabase
      .from("users")
      .update({ instructorverified: false })
      .eq("id", registration.submittedby);

      if (updateInstructorVerifiedError) {
      console.error("Error updating instructorverified:", updateInstructorVerifiedError.message);
      return res.status(500).send("Error updating instructorverified");
      }
    }

    // Check if status is 4, indicating the need to update the rejectmsg
    if (status == 4) {
      const { rejectmsg, rejectdescription } = req.body; // Capture the reject message from the form

      // Update the rejectmsg column
      const { error: updateRejectMsgError } = await supabase
      .from("instructor_registrations")
      .update({ rejectmsg: rejectmsg, rejectdescription: rejectdescription })
      .eq("id", applicationId);

      if (updateRejectMsgError) {
      console.error("Error updating rejectmsg:", updateRejectMsgError.message);
      return res.status(500).send("Error updating rejectmsg");
      }
    }

    // Check if status is 4, indicating the need to update the user's instructorverified column
    if (status == 3) {
      const { submittedby } = registration;

      console.log("Updating user with username:", submittedby);

      // Update the corresponding user's instructorverified column to true
      // const { data: user, error: updateUserError } = await supabase
      //   .from("users")
      //   .eq("id", submittedby)
      //   .select("*")
      //   .single();

      // if (updateUserError) {
      //   console.error("Error updating user:", updateUserError.message);
      //   return res.status(500).send("Error updating user");
      // }

      // Update the expireson column
      // const { error: updateExpiresOnError } = await supabase
      //   .from("instructor_registrations")
      //   .update({ expireson })
      //   .eq("id", applicationId);

      // if (updateExpiresOnError) {
      //   console.error("Error updating expireson:", updateExpiresOnError.message);
      //   return res.status(500).send("Error updating expireson");
      // }

      // const { data: applicantuser, error: applicantuserError } = await supabase
      //   .from("users")
      //   .select("*")
      //   .eq("id", submittedby)
      //   .single();

      // if (applicantuserError) {
      //   console.error("Error fetching applicantuser:", applicantuserError.message);
      //   return res.status(500).send("Error fetching applicantuser");
      // }

      // const { data: transactions, error: transactionError } = await supabase
      //   .from("transactions")
      //   .insert([
      //     {
      //       name: applicantuser.firstname + " " + applicantuser.lastname,
      //       userid: registration.submittedby,
      //       type: "Instructor",
      //       amount: 500, // Adjust the amount as needed
      //     },
      //   ]);

      // if (transactionError) {
      //   console.error("Error creating transaction:", transactionError.message);
      //   return res.status(500).send("Error creating transaction");
      // }

      // console.log("Instructor verified successfully");
    }

    res.redirect(`/instructor-review/${applicationId}`); // Redirect back to the review page
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/activate-instructor-membership", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { applicationId, submittedby } = req.body; // Capture application ID from the form
  let expireson = new Date();
  expireson.setFullYear(expireson.getFullYear() + 1);

  try {
    // Update the status of the specific registration in the database
    // const { data: registration, error: updateStatusError } = await supabase
    //   .from("instructor_registrations")
    //   .update({ expireson })
    //   .eq("id", applicationId)
    //   .select("*")
    //   .single(); // Fetch the updated registration to get the submittedby value

    // if (updateStatusError) {
    //   console.error("Error activating membership:", updateStatusError.message);
    //   return res.status(500).send("Error activating membership");
    // }

    // if (!registration) {
    //   return res.status(404).send("Registration not found");
    // }

    // Update the user's instructorverified column to true
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ instructorverified: true })
      .eq("id", submittedby);

    if (updateUserError) {
      console.error("Error updating user:", updateUserError.message);
      return res.status(500).send("Error updating user");
    }

    console.log("BRUH",  applicationId, submittedby);

    // Add a notification for the user about their membership activation
    // const { error: notificationError } = await supabase
    //   .from("notifications")
    //   .insert([
    //     {
    //       userid: registration.submittedby,
    //       type: "Membership",
    //       message: "Your Instructor membership has been activated.",
    //       desc: "Congratulations! Your Instructor membership is now active. Please check your membership status for details.",
    //     },
    //   ]);

    // if (notificationError) {
    //   console.error("Error creating notification:", notificationError.message);
    //   return res.status(500).send("Error creating notification");
    // }

    res.redirect(`/instructor-review/${applicationId}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-clubstatus", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { applicationId, status } = req.body; // Capture application ID and new status from the form

  try {
    // Update the status of the specific registration in the database
    const { data: clubregistration, error: updateStatusError } = await supabase
      .from("club_registrations")
      .update({ status })
      .eq("id", applicationId)
      .select("*")
      .single(); // Fetch the updated registration to get the submittedby value

    if (updateStatusError) {
      console.error("Error updating status:", updateStatusError.message);
      return res.status(500).send("Error updating status");
    }

    console.log("Registration updated:", clubregistration);
    
    // Check if status is 3 indicating the need to update the user's athleteverified column and insert into athletes table
    if (status == 3) {
      const {
        phonenum,
        email,
        clubname,
        clubaddress,
        province,
        submittedby,
        clubpic,
      } = clubregistration;

      console.log("Updating user with username:", submittedby);

      const registeredby = submittedby;

      let registeree = clubregistration.firstname + " " + clubregistration.lastname;
      const { error: insertClubError } = await supabase.from("clubs").insert([
        {
          clubname,
          phonenum,
          email,
          clubaddress,
          province,
          registeredby,
          registeree,
          clubpic,
        },
      ]);

      if (insertClubError) {
        console.error("Error inserting athlete:", insertClubError.message);
        return res.status(500).send("Error inserting club");
      }

      const { data: applicantuser, error: applicantuserError } = await supabase
        .from("users")
        .select("*")
        .eq("id", clubregistration.submittedby)
        .single();

      if (applicantuserError) {
        console.error("Error fetching applicantuser:", applicantuserError.message);
        return res.status(500).send("Error fetching applicantuser");
      }

      const { data: transactions, error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            name: applicantuser.firstname + " " + applicantuser.lastname,
            userid: clubregistration.submittedby,
            type: "Club",
            amount: 500, // Adjust the amount as needed
          },
        ]);

      if (transactionError) {
        console.error("Error creating transaction:", transactionError.message);
        return res.status(500).send("Error creating transaction");
      }

      console.log("Club inserted successfully");
    }
    

    // Add a notification for the user about their club registration status
    let statusMessage;
    let statusDesc;

    switch (parseInt(status, 10)) {
      case 1:
      statusMessage = "Your club registration is being processed.";
      statusDesc = "Your club registration is currently being processed. You will receive further updates soon.";
      break;
      case 3:
      statusMessage = "Your club registration has been accepted and shipped to the regional office.";
      statusDesc = "Congratulations! Your club registration has been accepted and shipped to the regional office. Please check with your regional office for further details.";
      break;
      case 4:

      const { rejectmsg, rejectdescription,  } = req.body; // Capture the reject message from the form
      const {
        firstname,
        lastname,
        phonenum,
        email,
        clubname,
        clubaddress,
        province,
        idfile,
        proofdoc,
        clubpic,
        paymentproof,
      } = req.body;

      // Update the rejectmsg column
      const { error: updateRejectMsgError } = await supabase
        .from("club_registrations")
        .update({ 
          rejectmsg: rejectmsg,
          rejectdescription: rejectdescription,
          firstname,
          lastname,
          phonenum,
          email,
          clubname,
          clubaddress,
          province,
          idfile,
          proofdoc,
          clubpic,
          paymentproof,
        })
        .eq("id", applicationId);

      if (updateRejectMsgError) {
        console.error("Error updating rejectmsg:", updateRejectMsgError.message);
        return res.status(500).send("Error updating rejectmsg");
      }
        statusMessage = "Your club registration has been rejected.";
        statusDesc = "Sorry, your club registration has been rejected. PLease see reason(s) for rejection in your membership status.";
      default:
      statusMessage = "Your club registration status has been updated.";
      statusDesc = "Your club registration status has been updated. Please check your registration details for more information.";
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
      {
        userid: clubregistration.submittedby,
        type: "Registration",
        message: statusMessage,
        desc: statusDesc,
      },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    res.redirect(`/clubreg-review/${applicationId}`); // Redirect back to the review page
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/add-comment", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { threadid, comment, parentid } = req.body;
  const commenter = req.session.user.username;

  try {
    // Insert the new comment into the database
    const { error } = await supabase.from("forum_comments").insert([
      {
        threadid,
        parentid: parentid === "null" ? null : parentid, // Handle replies
        commenter,
        comment,
      },
    ]);

    if (error) {
      console.error("Error inserting comment:", error.message);
      return res.status(500).send("Error inserting comment");
    }

    res.redirect(`/forum-thread/${threadid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-club",
  upload.fields([
    { name: "idfile", maxCount: 1 },
    { name: "proofdoc", maxCount: 1 },
    { name: "clubpic", maxCount: 1 },
    { name: "paymentproof", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      firstname,
      lastname,
      phonenum,
      email,
      clubname,
      clubaddress,
      province,
    } = req.body; // Capture user input from the form

    const status = 1;

    if (!req.session.user) {
      return res.status(401).send("Unauthorized: No user logged in");
    }

    const submittedby = req.session.user.id; // Get the current user's username from the session

    let idfileUrl = "";
    let proofdocUrl = "";
    let clubpicUrl = "";
    let paymentproofUrl = "";

    console.log("Files received:", req.files);

    if (req.files) {
      try {
        if (req.files.idfile) {
          const idfilePath = `documents/${Date.now()}-${
            req.files.idfile[0].originalname
          }`;
          console.log("Uploading ID file:", idfilePath);
          const { error: idfileError } = await supabase.storage
            .from("documents")
            .upload(idfilePath, req.files.idfile[0].buffer, {
              contentType: req.files.idfile[0].mimetype,
            });

          if (idfileError) {
            console.error("Error uploading ID file:", idfileError.message);
            return res.status(500).send("Error uploading ID file");
          }

          idfileUrl = `${supabaseUrl}/storage/v1/object/public/documents/${idfilePath}`;
          console.log("ID file uploaded to:", idfileUrl);
        }

        if (req.files.proofdoc) {
          const proofdocPath = `documents/${Date.now()}-${
            req.files.proofdoc[0].originalname
          }`;
          console.log("Uploading proof document:", proofdocPath);
          const { error: proofdocError } = await supabase.storage
            .from("documents")
            .upload(proofdocPath, req.files.proofdoc[0].buffer, {
              contentType: req.files.proofdoc[0].mimetype,
            });

          if (proofdocError) {
            console.error(
              "Error uploading proof document:",
              proofdocError.message
            );
            return res.status(500).send("Error uploading proof document");
          }

          proofdocUrl = `${supabaseUrl}/storage/v1/object/public/documents/${proofdocPath}`;
          console.log("Proof document uploaded to:", proofdocUrl);
        }

        if (req.files.clubpic) {
          const clubpicPath = `documents/${Date.now()}-${
            req.files.clubpic[0].originalname
          }`;
          console.log("Uploading club picture:", clubpicPath);
          const { error: clubpicError } = await supabase.storage
            .from("documents")
            .upload(clubpicPath, req.files.clubpic[0].buffer, {
              contentType: req.files.clubpic[0].mimetype,
            });

          if (clubpicError) {
            console.error(
              "Error uploading club picture:",
              clubpicError.message
            );
            return res.status(500).send("Error uploading club picture");
          }

          clubpicUrl = `${supabaseUrl}/storage/v1/object/public/documents/${clubpicPath}`;
          console.log("Club picture uploaded to:", clubpicUrl);
        }

        if (req.files.paymentproof) {
          const paymentproofPath = `documents/${Date.now()}-${
            req.files.paymentproof[0].originalname
          }`;
          console.log("Uploading club picture:", paymentproofPath);
          const { error: paymentproofError } = await supabase.storage
            .from("documents")
            .upload(paymentproofPath, req.files.paymentproof[0].buffer, {
              contentType: req.files.paymentproof[0].mimetype,
            });

          if (paymentproofError) {
            console.error(
              "Error uploading club picture:",
              paymentproofError.message
            );
            return res.status(500).send("Error uploading club picture");
          }

          paymentproofUrl = `${supabaseUrl}/storage/v1/object/public/documents/${paymentproofPath}`;
          console.log("Club picture uploaded to:", paymentproofUrl);
        }
      } catch (error) {
        console.error("Server error during file upload:", error.message);
        return res.status(500).json({ error: error.message });
      }
    }

    console.log("ID File URL:", idfileUrl);
    console.log("Proof Document URL:", proofdocUrl);
    console.log("Club Picture URL:", clubpicUrl);

    try {
      // Check if a row with the same submittedby already exists
      const { data: existingRegistration, error: existingRegistrationError } = await supabase
      .from("club_registrations")
      .select("*")
      .eq("submittedby", submittedby)
      .single();

      if (existingRegistrationError && existingRegistrationError.code !== 'PGRST116') {
      console.error("Error checking existing registration:", existingRegistrationError.message);
      return res.status(500).send("Error checking existing registration");
      }

      if (existingRegistration) {
      // Update the existing registration
      const { data, error } = await supabase
        .from("club_registrations")
        .update({
        firstname,
        lastname,
        phonenum,
        email,
        clubname,
        clubaddress,
        province,
        idfile: idfileUrl,
        proofdoc: proofdocUrl,
        clubpic: clubpicUrl, // Include the club picture URL
        paymentproof: paymentproofUrl, // Include the payment proof URL
        status,
        })
        .eq("submittedby", submittedby);

      if (error) {
        console.error("Error updating club registration:", error.message);
        return res.status(500).send("Error updating club registration");
      }

      console.log("Club registration updated successfully:", data);
      } else {
      // Insert a new registration
      const { data, error } = await supabase
        .from("club_registrations")
        .insert([
        {
          firstname,
          lastname,
          phonenum,
          email,
          clubname,
          clubaddress,
          province,
          idfile: idfileUrl,
          proofdoc: proofdocUrl,
          clubpic: clubpicUrl, // Include the club picture URL
          paymentproof: paymentproofUrl, // Include the payment proof URL
          submittedby,
          status,
        },
        ])
        .select(); // Ensure the data is returned

      if (error) {
        console.error("Error inserting club registration:", error.message);
        return res.status(500).send("Error inserting club registration");
      }

      console.log("Club registration submitted successfully:", data);
      }

      // Add a notification for the user about their club registration submission
      const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
        userid: submittedby,
        type: "Registration",
        message: "Your club registration has been successfully submitted.",
        desc: "Your club registration has been successfully submitted and is now awaiting review. You will receive notifications for the status of your application.",
        },
      ]);

      // Add a notification for PTA verified users about the new club registration submission
      const { data: ptaUsers, error: ptaUsersError } = await supabase
        .from("users")
        .select("id")
        .eq("ptaverified", true);

      if (ptaUsersError) {
        console.error("Error fetching PTA verified users:", ptaUsersError.message);
        return res.status(500).send("Error fetching PTA verified users");
      }

      const notifications = ptaUsers.map(user => ({
        userid: user.id,
        type: "Registration",
        message: "A new club registration has been submitted.",
        desc: "A new club registration has been submitted and is now awaiting review.",
      }));

      const { error: ptaNotificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (ptaNotificationError) {
        console.error("Error creating notifications for PTA verified users:", ptaNotificationError.message);
        return res.status(500).send("Error creating notifications for PTA verified users");
      }

      if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
      }

      res.redirect("membership-status"); // Redirect to a success page or another appropriate route
    } catch (error) {
      console.error("Server error during database insertion:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post("/invite-user", async (req, res) => {
  const { club_id, invited_user, clubname } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const inviter_user = req.session.user.username;
  const invitername = req.session.user.firstname + req.session.user.lastname;

  try {
    const { data, error } = await supabase
      .from("club_invitations")
      .insert([{ club_id, clubname, invited_user, inviter_user, invitername }]);

    if (error) {
      console.error("Error inviting user:", error.message);
      return res.status(500).send("Error inviting user");
    }

    res.redirect(`/clubs-details/${club_id}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/invite-player", async (req, res) => {
  const { athleteid, clubid,  } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const inviter_user = req.session.user.id; // Get the current user's ID
  const invitername = req.session.user.firstname + req.session.user.lastname;
  

  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("userid")
    .eq("id", athleteid)
    .single();

  if (athleteError) {
    return res.status(500).json({ error: athleteError.message });
  }

  const userid = athlete.userid;
  const invited_user = userid;
  try {
    // Fetch the club name where the club ID is provided
    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .select("clubname")
      .eq("id", clubid)
      .single();

    if (clubError) {
      return res.status(500).json({ error: clubError.message });
    }

    const clubname = clubData.clubname;
    const club_id = clubid;

    // Insert the invitation into the invitations table
    const { data, error } = await supabase
      .from("club_invitations")
      .insert([{ invited_user, inviter_user, club_id, clubname, invitername }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.redirect("/athletes"); // Redirect back to the athletes page after inviting
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/request-join-club", async (req, res) => {
  const { clubid, message } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userid = req.session.user.id;
  const username = req.session.user.username;
  const useremail = req.session.user.email;

  try {
    const { data, error } = await supabase
      .from("club_requests")
      .insert([{
        clubid, 
        userid,
        message,
        status: "pending",
       }]);

    if (error) {
      console.error("Error requesting to join club:", error.message);
      return res.status(500).send("Error requesting to join club");
    }

    // Add a notification for the club owner about the join request
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("registeredby")
      .eq("id", clubid)
      .single();

    if (clubError) {
      console.error("Error fetching club owner:", clubError.message);
      return res.status(500).send("Error fetching club owner");
    }

    const clubOwnerId = club.registeredby;

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: clubOwnerId,
          type: "Club",
          message: `New join request for your club.`,
          desc: `${username} has requested to join your club. Please review the request.`,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/accept-join-club-request", async (req, res) => {
  const { id, userid } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Fetch the join request details to get the clubname
    // Fetch the join request details to get the clubid
    const { data: joinRequest, error: fetchError } = await supabase
      .from("club_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !joinRequest) {
      console.error(
      "Error fetching join request:",
      fetchError ? fetchError.message : "Join request not found"
      );
      return res.status(500).send("Error fetching join request");
    }

    const clubid = joinRequest.clubid;

    // Fetch the club name from the clubs table using the clubid
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("clubname")
      .eq("id", clubid)
      .single();

    if (clubError || !club) {
      console.error(
      "Error fetching club name:",
      clubError ? clubError.message : "Club not found"
      );
      return res.status(500).send("Error fetching club name");
    }

    const clubname = club.clubname;

    // Update the join request status to 'accepted'
    const { error: updateRequestError } = await supabase
      .from("club_requests")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("userid", userid);

    if (updateRequestError) {
      console.error(
      "Error accepting join request:",
      updateRequestError.message
      );
      return res.status(500).send("Error accepting join request");
    }

    // Update the club column in the users table
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ 
        club: clubname,
        clubid: clubid 
      })
      .eq("id", userid);

    if (updateUserError) {
      console.error("Error updating user club:", updateUserError.message);
      return res.status(500).send("Error updating user club");
    }

    // Add a notification for the user about their club join request acceptance
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
      {
        userid,
        type: "Club",
        message: `Your request to join the club ${clubname} has been accepted.`,
        desc: `Congratulations! Your request to join the club ${clubname} has been accepted. You are now a member of the club.`,
      },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    // Update the session with the new club
    req.session.user.club = clubname;

    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }

});

app.post("/reject-join-club-request", async (req, res) => {
  const { id, userid, clubid } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Update the join request status to 'rejected'
    const { error: updateRequestError } = await supabase
      .from("club_requests")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("userid", userid);

    if (updateRequestError) {
      console.error("Error rejecting join request:", updateRequestError.message);
      return res.status(500).send("Error rejecting join request");
    }

    // Add a notification for the user about their club join request rejection
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid,
          type: "Club",
          message: "Your request to join the club has been rejected.",
          desc: "Unfortunately, your request to join the club has been rejected. Please contact the club for more information.",
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/accept-invitation/:id", async (req, res) => {
  const { id } = req.params;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userid = req.session.user.id;

  try {
    // Fetch the invitation details to get the clubname
    const { data: invitation, error: fetchError } = await supabase
      .from("club_invitations")
      .select("*")
      .eq("id", id)
      .eq("invited_user", userid)
      .single();

    if (fetchError || !invitation) {
      console.error(
        "Error fetching invitation:",
        fetchError ? fetchError.message : "Invitation not found"
      );
      return res.status(500).send("Error fetching invitation");
    }

    const clubid = invitation.club_id;
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("clubname")
      .eq("id", clubid)
      .single();

    if (clubError || !club) {
      console.error(
        "Error fetching club name:",
        clubError ? clubError.message : "Club not found"
      );
      return res.status(500).send("Error fetching club name");
    }

    const clubname = club.clubname;
    

    // Update the invitation status to 'accepted'
    const { error: updateInvitationError } = await supabase
      .from("club_invitations")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("invited_user", userid);

    if (updateInvitationError) {
      console.error(
        "Error accepting invitation:",
        updateInvitationError.message
      );
      return res.status(500).send("Error accepting invitation");
    }

    // Update the club column in the users table
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ 
        club: clubname,
        clubid: clubid,
      })
      .eq("id", userid);

    if (updateUserError) {
      console.error("Error updating user club:", updateUserError.message);
      return res.status(500).send("Error updating user club");
    }

    // Update the session with the new club
    req.session.user.club = clubname;

    res.redirect("/notifications");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/reject-invitation/:id", async (req, res) => {
  const { id } = req.params;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userid = req.session.user.id;

  try {
    const { data, error } = await supabase
      .from("club_invitations")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("invited_user", userid);

    if (error) {
      console.error("Error rejecting invitation:", error.message);
      return res.status(500).send("Error rejecting invitation");
    }

    res.redirect("/notifications");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/vote", async (req, res) => {
  const { type, threadId } = req.body;

  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: No user logged in" });
  }

  const userId = req.session.user.id;

  try {
    // Fetch the current thread
    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .select("upvotes, downvotes")
      .eq("id", threadId)
      .single();

    if (threadError) {
      return res
        .status(500)
        .json({ success: false, message: threadError.message });
    }

    let upvotes = thread.upvotes || [];
    let downvotes = thread.downvotes || [];

    // Check if the user has already upvoted or downvoted
    const hasUpvoted = upvotes.includes(userId);
    const hasDownvoted = downvotes.includes(userId);

    // Remove user from both arrays to ensure clean state
    upvotes = upvotes.filter((id) => id !== userId);
    downvotes = downvotes.filter((id) => id !== userId);

    // Add user to the appropriate array based on vote type, or remove if they already voted
    if (type === "upvote") {
      if (!hasUpvoted) {
        upvotes.push(userId);
      }
    } else if (type === "downvote") {
      if (!hasDownvoted) {
        downvotes.push(userId);
      }
    }

    // Update the thread with the new arrays
    const { data, error } = await supabase
      .from("forum_threads")
      .update({ upvotes, downvotes })
      .eq("id", threadId)
      .select();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect(`/forum-thread/${threadId}`); // Redirect back to the thread page
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/create-event", upload.single("eventpicture"), async (req, res) => {
  const {
    name,
    description,
    eventtype,
    registrationcap,
    date,
    starttime,
    endtime,
    location,
    agedivision,
    weightclass,
    beltlevel,
    gender,
    backoutdl,
    judges
  } = req.body; // Capture user input from the form

  const judgesArray = Array.isArray(judges) ? judges : [judges];

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const createdby = req.session.user.username; // Get the current user's username from the session
  let eventpictureUrl = null;

  if (req.file) {
    try {
      const filePath = `eventpictures/${Date.now()}-${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        console.error("Error uploading event picture:", uploadError.message);
        return res.status(500).send("Error uploading event picture");
      }

      eventpictureUrl = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
    } catch (error) {
      console.error("Server error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  try {
    // Insert the new event into the database
    const { data, error } = await supabase
      .from("events")
      .insert([
        {
          name,
          description,
          eventpicture: eventpictureUrl,
          eventtype,
          createdby,
          registrationcap,
          date,
          starttime,
          endtime,
          location,
          judges: `{${judgesArray.join(',')}}`,
          agedivision,
          weightclass,
          beltlevel,
          gender,
          status: "Active",
          backoutdl,
        },
      ])
      .select(); // Ensure the data is returned

    if (error) {
      console.error("Error creating event:", error.message);
      return res.status(500).send("Error creating event");
    }

    console.log("Event created successfully:", data);

    res.redirect("/events"); // Redirect to a success page or another appropriate route
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-event", upload.single("eventpicture"), async (req, res) => {
  const {
    eventid, // Event ID to identify the event to update
    name,
    description,
    date,
    backoutdl,
    eventtype,
    createdby,
    registrationcap,
    location,
    starttime,
    endtime,
    agedivision,
    beltlevel,
    weightclass,
    status,
    gender,
    judges
  } = req.body;

  let eventpicture = null;
  if (req.file) {
    try {
      const filePath = `eventpictures/${Date.now()}-${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        console.error("Error uploading event picture:", uploadError.message);
        return res.status(500).send("Error uploading event picture");
      }

      eventpicture = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
    } catch (error) {
      console.error("Server error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  try {
    // Fetch the current event details to retain the old event picture if no new one is uploaded
    if (!eventpicture) {
      const { data: currentEvent, error: fetchError } = await supabase
        .from("events")
        .select("eventpicture")
        .eq("id", eventid)
        .single();

      if (fetchError) {
        console.error("Error fetching current event picture:", fetchError.message);
        return res.status(500).send("Error fetching current event picture");
      }

      eventpicture = currentEvent.eventpicture;
    }

    // Ensure judges is an array
    const judgesArray = Array.isArray(judges) ? judges : [judges];

    // Update event details in Supabase database
    const { data, error } = await supabase
      .from("events") // Assuming your table is called 'events'
      .update({
        name: name,
        description: description,
        eventpicture: eventpicture, // Use the public URL of the uploaded image or the old one
        date: date,
        backoutdl: backoutdl,
        eventtype: eventtype,
        createdby: createdby,
        registrationcap: registrationcap,
        location: location,
        starttime: starttime,
        endtime: endtime,
        status: status,
        agedivision: agedivision,
        beltlevel: beltlevel,
        gender: gender,
        weightclass: weightclass,
        judges: `{${judgesArray.join(',')}}`,
      })
      .eq("id", eventid); // Match the event ID

      // Notify players of the event update
      const { data: registeredPlayers, error: registeredPlayersError } = await supabase
        .from("events_registrations")
        .select("userid")
        .eq("eventid", eventid)
        .eq("registered", "true");

      if (registeredPlayersError) {
        console.error("Error fetching registered players:", registeredPlayersError.message);
        return res.status(500).send("Error fetching registered players");
      }

      const notifications = registeredPlayers.map((player) => ({
        userid: player.userid,
        type: "Event",
        message: `The event ${name} has been updated.`,
        desc: `The event ${name} has been updated. Please check the event details for more information.`,
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Error creating notifications:", notificationError.message);
        return res.status(500).send("Error creating notifications");
      }

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: "Failed to update event", error });
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ message: "Server error, unable to update event" });
  }
  
});

app.post("/cancel-event/:id", async (req, res) => {
  const { id } = req.params;
  const { cancelmsg, cancelreason } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Update the event status to "Cancelled"
    const { error } = await supabase
      .from("events")
      .update({ status: "Cancelled", cancelmsg, cancelreason })
      .eq("id", id);

    if (error) {
      console.error("Error cancelling event:", error.message);
      return res.status(500).send("Error cancelling event");
    }

    // Fetch the registered users for the event
    const { data: registeredUsers, error: registeredUsersError } = await supabase
      .from("events_registrations")
      .select("userid")
      .eq("eventid", id)
      .eq("registered", "true");

    if (registeredUsersError) {
      console.error("Error fetching registered users:", registeredUsersError.message);
      return res.status(500).send("Error fetching registered users");
    }

    // Fetch the event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("name, date")
      .eq("id", id)
      .single();

    if (eventError) {
      console.error("Error fetching event details:", eventError.message);
      return res.status(500).send("Error fetching event details");
    }

    // Create notifications for each registered user
    const notifications = registeredUsers.map((user) => ({
      userid: user.userid,
      type: "Event",
      message: `The event ${event.name} has been cancelled.`,
      desc: `The event ${event.name} scheduled for ${event.date} has been cancelled. Please check the event details for more information.`,
    }));

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      console.error("Error creating notifications:", notificationError.message);
      return res.status(500).send("Error creating notifications");
    }

    res.redirect(`/events-details/${id}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/delete-club/:id", async (req, res) => {
  const { id } = req.params;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Delete the club from the database
    const { error } = await supabase
      .from("clubs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting club:", error.message);
      return res.status(500).send("Error deleting club");
    }

    res.redirect("/clubs");
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const eventImageUpload = multer();

app.post("/submit-player", upload.fields([{ name: 'heightpicture' }, { name: 'weightpicture' }]), async (req, res) => {
  const {
    userid,
    athleteid,
    eventid,
    email,
    playername,
    club,
    age,
    bday,
    division,
    belt,
    height,
    weight,
    instructor
  } = req.body;

  const registered = "false";
  
  // Upload file helper function
  const uploadFile = async (file, folder) => {
    if (!file) return null;
    const filePath = `${folder}/${Date.now()}-${file.originalname}`;
    const { error } = await supabase.storage.from("documents").upload(filePath, file.buffer, {
      contentType: file.mimetype,
    });
    if (error) throw new Error(`Error uploading ${folder} image: ${error.message}`);
    return `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
  };

  try {
    // Upload images if they exist
    const heightPictureUrl = req.files['heightpicture'] ? await uploadFile(req.files['heightpicture'][0], 'heightpictures') : null;
    const weightPictureUrl = req.files['weightpicture'] ? await uploadFile(req.files['weightpicture'][0], 'weightpictures') : null;

    // Insert registration data along with URLs for height and weight pictures
    const { data: registrationData, error: registrationError } = await supabase
      .from("events_registrations")
      .insert([
        {
          athleteid,
          userid: userid,
          eventid,
          registered,
          email,
          playername,
          club,
          age,
          bday,
          division,
          belt,
          height,
          weight,
          instructor,
          heightpicture: heightPictureUrl,
          weightpicture: weightPictureUrl
        },
      ]);

    if (registrationError) {
      console.error("Error creating registration:", registrationError.message);
      return res.status(500).send("Error creating registration.");
    }

    // Fetch the event details and create a notification
    const { data: thisevent, error: thiseventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventid)
      .single();

    if (thiseventError) {
      console.error("Error fetching event details:", thiseventError.message);
      return res.status(500).send("Error fetching event details.");
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: userid,
          type: "Event",
          message: `You have successfully registered for ${thisevent.name}`,
          desc: `Your registration for the event ${thisevent.name} has been successfully submitted.`,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    // Notify admins about the new player registration
    const { data: admins, error: adminsError } = await supabase
      .from("users")
      .select("id")
      .eq("ptaverified", true);

    if (adminsError) {
      console.error("Error fetching admins:", adminsError.message);
      return res.status(500).send("Error fetching admins");
    }

    const adminNotifications = admins.map(admin => ({
      userid: admin.id,
      type: "Event",
      message: `A new player has registered for the event ${thisevent.name}.`,
      desc: `A new player has registered for the event ${thisevent.name}. Please review the registration.`,
    }));

    const { error: adminNotificationError } = await supabase
      .from("notifications")
      .insert(adminNotifications);

    if (adminNotificationError) {
      console.error("Error creating admin notifications:", adminNotificationError.message);
      return res.status(500).send("Error creating admin notifications");
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Error handling registration.");
  }
});

app.post("/withdraw-from-event", async (req, res) => {
  const { eventid, userid } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    // Delete the event registration
    const { error } = await supabase
      .from("events_registrations")
      .delete()
      .eq("eventid", eventid)
      .eq("userid", userid);

    if (error) {
      console.error("Error withdrawing from event:", error.message);
      return res.status(500).send("Error withdrawing from event");
    }

    // Fetch the event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("name")
      .eq("id", eventid)
      .single();

    if (eventError) {
      console.error("Error fetching event details:", eventError.message);
      return res.status(500).send("Error fetching event details");
    }

    // Create a notification for the user about their withdrawal
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid,
          type: "Event",
          message: `You have successfully withdrawn from the event ${event.name}.`,
          desc: `Your registration for the event ${event.name} has been successfully withdrawn.`,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/begin-promotion-event/:id", async (req, res) => {
  const { id: eventid } = req.params; // Get the event ID from the URL

  try {
    // Fetch the event registrations for the specific event where registered is true
    const { data: registeredPlayers, error: registeredPlayersError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("eventid", eventid)
      .eq("registered", "true");

    if (registeredPlayersError) {
      console.error("Error fetching registered players:", registeredPlayersError.message);
      return res.status(500).send("Error fetching registered players.");
    }

    // Insert the registered players into the promotion_players table
    const promotionPlayers = registeredPlayers.map(player => ({
      eventid: player.eventid,
      userid: player.userid,
      athleteid: player.athleteid,
    }));

    const { error: insertError } = await supabase
      .from("promotion_players")
      .insert(promotionPlayers);

    if (insertError) {
      console.error("Error inserting promotion players:", insertError.message);
      return res.status(500).send("Error inserting promotion players.");
    }

    // Update the event status to 'Ongoing'
    const { error: updateEventStatusError } = await supabase
      .from("events")
      .update({ status: "Ongoing" })
      .eq("id", eventid);

    if (updateEventStatusError) {
      console.error("Error updating event status:", updateEventStatusError.message);
      return res.status(500).send("Error updating event status.");
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/conclude-promotion-event/:id", async (req, res) => {
  const { id: eventid } = req.params;

  const { data: promotionPlayers, error: promotionPlayersError } = await supabase
    .from("promotion_players")
    .select("*")
    .eq("eventid", eventid);

  if (promotionPlayersError) {
    console.error("Error fetching promotion players:", promotionPlayersError.message);
    return res.status(500).send("Error fetching promotion players");
  }

  for (const player of promotionPlayers) {
    const { form, selfdef, kicking, freesparring, basicmove, behavior, breaking, athleteid } = player;

    // Check if all grades are 3 and above
    const passed = form >= 3 && selfdef >= 3 && kicking >= 3 && freesparring >= 3 && basicmove >= 3 && behavior >= 3 && breaking >= 3;
    const result = passed ? "Pass" : "Fail";

    if (passed) {
      // Fetch the current belt level of the athlete
      const { data: athlete, error: athleteError } = await supabase
        .from("athletes")
        .select("beltlevel")
        .eq("id", athleteid)
        .single();

      if (athleteError) {
        console.error("Error fetching athlete:", athleteError.message);
        continue;
      }

      const beltLevels = [
        "White Belt",
        "Low Yellow Belt",
        "High Yellow Belt",
        "Low Blue Belt",
        "High Blue Belt",
        "Low Red Belt",
        "High Red Belt",
        "Low Brown Belt",
        "High Brown Belt",
        "Junior/Poom Black Belt",
        "Black/Dan Belt"
      ];

      const currentBeltIndex = beltLevels.findIndex(belt => belt.toLowerCase() === athlete.beltlevel.toLowerCase());
      const newBeltLevel = currentBeltIndex >= 0 && currentBeltIndex < beltLevels.length - 1
        ? beltLevels[currentBeltIndex + 1]
        : athlete.beltlevel;

      const { error: updateError } = await supabase
        .from("athletes")
        .update({ 
          beltlevel: newBeltLevel,
          lastpromo: new Date().toISOString().split('T')[0]
        })
        .eq("id", athleteid);

      if (updateError) {
        console.error("Error updating belt level:", updateError.message);
      }

      const { error: updatePendingPromoError } = await supabase
        .from("users")
        .update({ pendingpromo: false })
        .eq("id", player.userid);

      if (updatePendingPromoError) {
        console.error("Error updating pendingpromo:", updatePendingPromoError.message);
        return res.status(500).send("Error updating pendingpromo");
      }

      console.log("New Belt Level:", newBeltLevel);
    }

    // Update the result column for the promotion player
    const { error: updateResultError } = await supabase
      .from("promotion_players")
      .update({ result })
      .eq("id", player.id);

    if (updateResultError) {
      console.error("Error updating result:", updateResultError.message);
    }
  }

  // Update the event status to 'Concluded'
  const { error: updateEventStatusError } = await supabase
    .from("events")
    .update({ status: "Concluded" })
    .eq("id", eventid);

  if (updateEventStatusError) {
    console.error("Error updating event status:", updateEventStatusError.message);
    return res.status(500).send("Error updating event status");
  }

  res.redirect(`/events-details/${eventid}`);
});


app.post("/begin-kyorugi-competition/:id", async (req, res) => {
  const { id: eventid } = req.params; // Get the event ID from the URL

  try {
    // Fetch the event registrations for the specific event
    // const { data: eventregistrations, error: eventregistrationsError } =
    //   await supabase
    //     .from("events_registrations")
    //     .select("*")
    //     .eq("eventid", eventid);

    // if (eventregistrationsError) {
    //   console.error(
    //     "Error fetching event registrations:",
    //     eventregistrationsError.message
    //   );
    //   return res.status(500).send("Error fetching event registrations.");
    // }

    // Fetch the event registrations for the specific event where registered is true
    const { data: registeredEventRegistrations, error: registeredEventRegistrationsError } =
      await supabase
      .from("events_registrations")
      .select("*")
      .eq("eventid", eventid)
      .eq("registered", "true");

    if (registeredEventRegistrationsError) {
      console.error(
      "Error fetching registered event registrations:",
      registeredEventRegistrationsError.message
      );
      return res.status(500).send("Error fetching registered event registrations.");
    }

    // Fetch the event details to get the registration cap
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventid)
      .single();

    if (eventError) {
      console.error("Error fetching event details:", eventError.message);
      return res.status(500).send("Error fetching event details.");
    }

    // Update the event status to 'Ongoing'
    const { error: updateEventStatusError } = await supabase
      .from("events")
      .update({ status: "Ongoing" })
      .eq("id", eventid);

    if (updateEventStatusError) {
      console.error("Error updating event status:", updateEventStatusError.message);
      return res.status(500).send("Error updating event status.");
    }

    // Check if the registration cap has been reached
    if (registeredEventRegistrations.length >= event.registrationcap) {
      // Create pairs for the knockout matches
      function createKnockoutPairs(registrations) {
        const pairs = [];
        for (let i = 0; i < registrations.length; i += 2) {
          if (registrations[i + 1]) {
            pairs.push([registrations[i], registrations[i + 1]]);
          } else {
            pairs.push([registrations[i]]); // Handle odd number of participants
          }
        }
        return pairs;
      }

      const pairs = createKnockoutPairs(registeredEventRegistrations);
      const round = 1;
      for (const pair of pairs) {
        const { error } = await supabase
          .from("kyorugi_matches")
          .insert([
            {
              eventid,
              player1: pair[0].userid,
              player2: pair[1]?.userid,
              round,
              matchtype: "regular",
            },
          ]);

        if (error) {
          console.error("Error creating matches:", error.message);
          return res.status(500).send("Error creating matches.");
        }
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/next-kyorugi-round/:eventid", async (req, res) => {
  const { eventid } = req.params;

  try {
    const { data: highestRound, error: roundError } = await supabase
      .from("kyorugi_matches")
      .select("round")
      .eq("eventid", eventid)
      .order("round", { ascending: false })
      .limit(1)
      .single();

    if (roundError) {
      console.error("Error fetching highest round:", roundError.message);
      return res.status(500).send("Error fetching highest round");
    }

    const currentRound = highestRound ? highestRound.round : 0;

    const { data: matches, error: matchesError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", eventid)
      .eq("round", currentRound)
      .eq("matchtype", "regular");

    if (matchesError) {
      console.error("Error fetching matches:", matchesError.message);
      return res.status(500).send("Error fetching matches");
    }

    const allMatchesCompleted = matches.every(
      (match) => match.winner !== null && match.loser !== null
    );
    if (!allMatchesCompleted) {
      console.log("Not all matches are completed.");
      return res.status(400).send("Not all matches are completed.");
    }

    const winners = matches
      .map((match) => match.winner)
      .filter((winner) => winner !== 0);

    function createPairs(players) {
      const pairs = [];
      for (let i = 0; i < players.length; i += 2) {
        if (players[i + 1]) {
          pairs.push([players[i], players[i + 1]]);
        } else {
          pairs.push([players[i]]); // Handle odd number of participants
        }
      }
      return pairs;
    }

    const pairs = createPairs(winners);
    const nextRound = currentRound + 1;

    if (matches.length === 2) {
      const { error: finalMatchError } = await supabase
        .from("kyorugi_matches")
        .insert([
          {
            eventid,
            player1: pairs[0][0],
            player2: pairs[0][1] || null,
            round: nextRound,
            matchtype: "final",
          },
        ]);

      if (finalMatchError) {
        console.error("Error creating final match:", finalMatchError.message);
      }

      console.log("Final match created.");
    } else {
      for (const pair of pairs) {
        const { error } = await supabase
          .from("kyorugi_matches")
          .insert([
            {
              eventid,
              player1: pair[0],
              player2: pair[1] || null,
              round: nextRound,
              matchtype: "regular",
            },
          ]);

        if (error) {
          console.error("Error creating next round match:", error.message);
        }
      }

      console.log("Next round matches created.");
    }

    // Update the current round in the events table

    console.log("MATCHES LENGTHELTHELHTLETLJFKLD:", matches.length);
    if (matches.length <= 2) {
      const { error: updateRoundError } = await supabase
      .from("events")
      .update({ currentround: 2 })
      .eq("id", eventid);

      if (updateRoundError) {
      console.error("Error updating current round:", updateRoundError.message);
      return res.status(500).send("Error updating current round");
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/decide-kyorugi-winners/:eventid", async (req, res) => {
  const { eventid } = req.params;

  try {
    // Update the event status to "Concluded"
    const { error: updateEventStatusError } = await supabase
      .from("events")
      .update({ status: "Concluded" })
      .eq("id", eventid);

    if (updateEventStatusError) {
      console.error("Error updating event status:", updateEventStatusError.message);
      return res.status(500).send("Error updating event status");
    }

    // Fetch the final match to determine the winners
    const { data: finalMatch, error: finalMatchError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", eventid)
      .eq("matchtype", "final")
      .single();

    if (finalMatchError) {
      console.error("Error fetching final match:", finalMatchError.message);
      return res.status(500).send("Error fetching final match");
    }

    const championId = finalMatch.winner;
    const secondPlaceId = finalMatch.loser;
    const secondPlaceScore = Math.min(finalMatch.player1score, finalMatch.player2score);
    const secondPlaceDqReason = finalMatch.dqreason;

    console.log("secondplacescore", secondPlaceScore);
    

    const { data: disqualifiedMatches, error: disqualifiedMatchesError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", eventid)
      .or("player1score.eq.-1,player2score.eq.-1");

    if (disqualifiedMatchesError) {
      console.error("Error fetching disqualified matches:", disqualifiedMatchesError.message);
      return res.status(500).send("Error fetching disqualified matches");
    }

    const disqualifiedPlayers = disqualifiedMatches.map(match => ({
      loser: match.loser,
      dqreason: match.dqreason
    }));

    // Fetch the highest round number for the event
    const { data: highestRound, error: highestRoundError } = await supabase
      .from("kyorugi_matches")
      .select("round")
      .eq("eventid", eventid)
      .order("round", { ascending: false })
      .limit(1)
      .single();

    if (highestRoundError) {
      console.error("Error fetching highest round:", highestRoundError.message);
      return res.status(500).send("Error fetching highest round");
    }

    const currentRound = highestRound ? highestRound.round : 0;

    // Fetch the semifinal matches to determine the third place winners
    const { data: semifinalMatches, error: semifinalMatchesError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", eventid)
      .eq("round", currentRound - 1);

    if (semifinalMatchesError) {
      console.error("Error fetching semifinal matches:", semifinalMatchesError.message);
      return res.status(500).send("Error fetching semifinal matches");
    }

    const thirdPlaceIds = semifinalMatches ? semifinalMatches.map(match => match.loser) : [];
    const thirdPlaceScores = semifinalMatches.map(match => Math.min(match.player1score, match.player2score));
    const thirdPlaceDqReasons = semifinalMatches.map(match => match.dqreason);
    console.log("thirdPlaceScores", thirdPlaceScores);


    // Fetch all participants
    const { data: participants, error: participantsError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("eventid", eventid)
      .eq("registered", "true");

    if (participantsError) {
      console.error("Error fetching participants:", participantsError.message);
      return res.status(500).send("Error fetching participants");
    }

    // Fetch the event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventid)
      .single();

    if (eventError) {
      console.error("Error fetching event details:", eventError.message);
      return res.status(500).send("Error fetching event details");
    }

    // Insert match history for all participants
    for (const participant of participants) {
      let ranking = 0;
      let dq = null;
      let dqreason = null;

      if (participant.userid === championId) {
      ranking = 1;
      } else if (participant.userid === secondPlaceId) {
      ranking = 2;
      if (secondPlaceScore === -1) {
        dq = "DQ";
        dqreason = secondPlaceDqReason;
      }
      } else if (thirdPlaceIds.includes(participant.userid)) {
      ranking = 3;
      if (thirdPlaceScores[thirdPlaceIds.indexOf(participant.userid)] === -1) {
        dq = "DQ";
        dqreason = thirdPlaceDqReasons[thirdPlaceIds.indexOf(participant.userid)];
      } 
      } else if (disqualifiedPlayers.some(player => player.loser === participant.userid)) {
      dq = "DQ";
      dqreason = disqualifiedPlayers.find(player => player.loser === participant.userid).dqreason;
      } else {
      ranking = 0; // Ensure ranking is reset for each participant
      dq = null;
      dqreason = null;
      }

      console.log("Athlete ID:", participant.athleteid);
      console.log("DQ:", dq);
      console.log("DQ Reason:", dqreason);

      const { error: matchHistoryError } = await supabase
      .from("match_history")
      .insert([
      {
        eventid,
        athleteid: participant.athleteid,
        ranking,
        eventname: event.name,
        eventlocation: event.location,
        dq,
        dqreason: dqreason, // Insert dqreason
      },
      ]);

      if (matchHistoryError) {
      console.error("Error inserting match history:", matchHistoryError.message);
      return res.status(500).send("Error inserting match history");
      }

      // Notify players with DQ about pending promotion test
      if (dq === "DQ" && dqreason === "Overqualified") {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert([
          {
            userid: participant.userid,
            type: "Event",
            message: "Pending Promotion Test",
            desc: `You have been disqualified from the event ${event.name} due to being overqualified. Please contact your instructor to schedule a promotion test.`,
          },
          ]);

        if (notificationError) {
          console.error("Error creating notification:", notificationError.message);
          return res.status(500).send("Error creating notification");
        }

        const { data: deletedRows, error: deleteRegistrationsError } = await supabase
          .from("events_registrations")
          .delete()
          .eq("userid", participant.userid)
          .neq("eventid", eventid);

        if (deleteRegistrationsError && deleteRegistrationsError.code !== 'PGRST116') {
          console.error("Error deleting event registrations:", deleteRegistrationsError.message);
          return res.status(500).send("Error deleting event registrations");
        }

        if (!deletedRows || deletedRows.length === 0) {
          console.warn("No event registrations were deleted for the given user ID:", participant.userid);
        }

        const { error: updatePendingPromoError } = await supabase
          .from("users")
          .update({ pendingpromo: true })
          .eq("id", participant.userid);

        if (updatePendingPromoError) {
          console.error("Error updating pendingpromo:", updatePendingPromoError.message);
          return res.status(500).send("Error updating pendingpromo");
        }
      }
    }

    const notifications = participants.map((participant) => ({
      userid: participant.userid,
      type: "Event",
      message: `The event ${event.name} has concluded.`,
      desc: `The event ${event.name} has concluded. Check the event details for the results.`,
    }));

    const { data: registeredParticipants, error: registeredParticipantsError } = await supabase
      .from("events_registrations")
      .select("athleteid")
      .eq("eventid", eventid)
      .eq("registered", "true");

    if (registeredParticipantsError) {
      console.error("Error fetching registered participants:", registeredParticipantsError.message);
      return res.status(500).send("Error fetching registered participants");
    }

    for (const participant of registeredParticipants) {
      const { data: athlete, error: athleteError } = await supabase
        .from("athletes")
        .select("gp")
        .eq("id", participant.athleteid)
        .single();

      if (athleteError) {
        console.error("Error fetching athlete:", athleteError.message);
        continue;
      }

      const newGp = (athlete.gp || 0) + 1;

      const { error: updateGpError } = await supabase
        .from("athletes")
        .update({ gp: newGp })
        .eq("id", participant.athleteid);

      if (updateGpError) {
        console.error("Error updating gp:", updateGpError.message);
      }
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      console.error("Error creating notifications:", notificationError.message);
      return res.status(500).send("Error creating notifications");
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/begin-poomsae-competition/:id", async (req, res) => {

  const { id: eventid } = req.params; // Get the event ID from the URL

    try {
      // Fetch all registered players for the event
      const { data: players, error: playersError } = await supabase
        .from("events_registrations")
        .select("*")
        .eq("eventid", eventid)
        .eq("registered", "TRUE");

      if (playersError) {
        console.error("Error fetching registered players:", playersError.message);
        return;
      }
      
      // Insert all players' userid and athlete id into the poomsae_players table
      for (const player of players) {
        // Check if the player already exists in the poomsae_players table
        const { data: existingPlayer, error: fetchError } = await supabase
          .from("poomsae_players")
          .select("*")
          .eq("eventid", eventid)
          .eq("userid", player.userid)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error("Error checking existing poomsae player:", fetchError.message);
          continue;
        }

        if (!existingPlayer) {
          const { error: insertError } = await supabase
        .from("poomsae_players")
        .insert([
          {
            eventid,
            userid: player.userid,
            athleteid: player.athleteid,
            round: 1,
            name: player.playername,
          },
        ]);

          if (insertError) {
        console.error("Error inserting poomsae player:", insertError.message);
          }
        }
      }

      const { error: updateEventError } = await supabase
        .from("events")
        .update({ 
          status: "Ongoing",
          currentround: 1,
         })
        .eq("id", eventid);

      if (updateEventError) {
        console.error("Error updating event status:", updateEventError.message);
        return res.status(500).send("Error updating event status");
      }

      console.log("Poomsae players inserted successfully");
    } catch (error) {
      console.error("Server error:", error.message);
    }

  res.redirect(`/events-details/${req.params.id}`);
});

app.post("/next-poomsae-round/:eventid", async (req, res) => {
  const { eventid } = req.params;

  try {
    // Fetch the highest round number for the event
    const { data: highestRound, error: highestRoundError } = await supabase
      .from("poomsae_players")
      .select("round")
      .eq("eventid", eventid)
      .order("round", { ascending: false })
      .limit(1)
      .single();

    if (highestRoundError) {
      console.error("Error fetching highest round:", highestRoundError.message);
      return res.status(500).send("Error fetching highest round");
    }

    const currentRound = highestRound ? highestRound.round : 0;

    // Fetch players who participated in the current round
    const { data: players, error: playersError } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("eventid", eventid)
      .eq("round", currentRound);

    if (playersError) {
      console.error("Error fetching players:", playersError.message);
      return res.status(500).send("Error fetching players");
    }

    // Update the current round in the events table
    const { error: updateRoundError } = await supabase
      .from("events")
      .update({ currentround: currentRound + 1 })
      .eq("id", eventid);

    if (updateRoundError) {
      console.error("Error updating current round:", updateRoundError.message);
      return res.status(500).send("Error updating current round");
    }

    // Determine the players who advance to the next round based on their scores
      const advancingPlayers = players
        .sort((a, b) => b.totalscore - a.totalscore)
        .map((player, index) => {
        if (players.length >= 35) {
          return index < 12 ? player : { ...player, ranking: 0 };
        } else {
          return index < 8 ? player : { ...player, ranking: 0 };
        }
        });

    const nextRound = currentRound + 1;

    // Insert advancing players into the next round, carrying over their total scores
    for (const player of advancingPlayers) {
      const { error: insertError } = await supabase
      .from("poomsae_players")
      .insert([
        {
        eventid,
        userid: player.userid,
        athleteid: player.athleteid,
        round: nextRound,
        name: player.name,
        totalscore: player.totalscore, // Carry over the total score
        ranking: player.ranking,
        dqreason: player.dqreason, // Carry over the dqreason
        },
      ]);

      if (insertError) {
      console.error("Error advancing player:", insertError.message);
      return res.status(500).send("Error advancing player");
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/decide-poomsae-winners/:eventid", async (req, res) => {
  const { eventid } = req.params;

  try {
    // Fetch all events using eventid
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventid)
      .single();

    if (eventsError) {
      console.error("Error fetching events:", eventsError.message);
      return res.status(500).send("Error fetching events");
    }

    console.log("Fetched events data:", events); // Log the events data to the console
    // Update the current round in the events table
    const { error: updateRoundError } = await supabase
      .from("events")
      .update({ currentround: 3 })
      .eq("id", eventid);

    if (updateRoundError) {
      console.error("Error updating current round:", updateRoundError.message);
      return res.status(500).send("Error updating current round");
    }

    // Fetch players who participated in the highest round
    const { data: players, error: playersError } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("eventid", eventid)
      .order("round", { ascending: false }) // Prioritize higher round
      .order("totalscore", { ascending: false });

    if (playersError) {
      console.error("Error fetching players:", playersError.message);
      return res.status(500).send("Error fetching players");
    }

    // Create a map to track the highest round and total score for each unique userid
    const playerMap = new Map();

    players.forEach(player => {
      const existingPlayer = playerMap.get(player.userid);
      if (!existingPlayer || player.round > existingPlayer.round || (player.round === existingPlayer.round && player.totalscore > existingPlayer.totalscore)) {
      playerMap.set(player.userid, player);
      }
    });

    // Convert the map values to an array and sort by total score
    const sortedPlayers = Array.from(playerMap.values()).sort((a, b) => b.totalscore - a.totalscore);

    // Update the ranking for each player
    for (let i = 0; i < sortedPlayers.length; i++) {
      const ranking = i < 4 ? i + 1 : 0; // Assign ranking 1-4, and 0 for others
      sortedPlayers[i].ranking = ranking; // Ensure ranking is set on the player object
      const { error: updateError } = await supabase
      .from("poomsae_players")
      .update({ ranking })
      .eq("id", sortedPlayers[i].id);

      if (updateError) {
      console.error("Error updating ranking:", updateError.message);
      return res.status(500).send("Error updating ranking");
      }
    }

    // Update the ranking for all players 
    for (let i = 0; i < sortedPlayers.length; i++) {
      const ranking = i < 4 ? i + 1 : 0; // Assign ranking 1-4, and 0 for others
      sortedPlayers[i].ranking = ranking; // Ensure ranking is set on the player object
      const { error: updateError } = await supabase
      .from("poomsae_players")
      .update({ ranking })
      .eq("id", sortedPlayers[i].id);

      if (updateError) {
      console.error("Error updating ranking:", updateError.message);
      return res.status(500).send("Error updating ranking");
      }
    }

    // Insert each player's match history into the match_history table
    for (const player of sortedPlayers) {
      const { error: matchHistoryError } = await supabase
      .from("match_history")
      .insert([
      {
        eventid,
        athleteid: player.athleteid,
        ranking: player.ranking,
        eventname: events.name,
        eventlocation: events.location,
        poomsaefinalscore: player.totalscore,
        dqreason: player.dqreason,
        dq: player.totalscore === -1 ? "DQ" : null,
      },
      ]);

      if (matchHistoryError) {
      console.error("Error inserting match history:", matchHistoryError.message);
      return res.status(500).send("Error inserting match history");
      }

      // If the player is disqualified due to being overqualified, update their pendingpromo to true
      if (player.totalscore === -1 && player.dqreason === "Overqualified") {
        const { error: updatePendingPromoError } = await supabase
          .from("users")
          .update({ pendingpromo: true })
          .eq("id", player.userid);

        if (updatePendingPromoError) {
          console.error("Error updating pendingpromo:", updatePendingPromoError.message);
          return res.status(500).send("Error updating pendingpromo");
        }

        const { data: deletedRows, error: deleteRegistrationsError } = await supabase
          .from("events_registrations")
          .delete()
          .eq("userid", player.userid)
          .neq("eventid", eventid);

        if (deleteRegistrationsError && deleteRegistrationsError.code !== 'PGRST116') {
          console.error("Error deleting event registrations:", deleteRegistrationsError.message);
          return res.status(500).send("Error deleting event registrations");
        }

        if (!deletedRows || deletedRows.length === 0) {
          console.warn("No event registrations were deleted for the given user ID:", player.userid);
        }

      }
    }

    // Update the 'gp' column for each athlete
    for (const player of sortedPlayers) {
      const { error: fetchGpError, data: athlete } = await supabase
        .from("athletes")
          .select("gp")
          .eq("id", player.athleteid)
          .single();
  
        if (fetchGpError) {
          console.error("Error fetching gp:", fetchGpError.message);
          return res.status(500).send("Error fetching gp");
        }
  
        const newGp = (athlete.gp || 0) + 1;
  
        const { error: updateGpError } = await supabase
          .from("athletes")
          .update({ gp: newGp })
          .eq("id", player.athleteid);

      if (updateGpError) {
        console.error("Error updating gp:", updateGpError.message);
        return res.status(500).send("Error updating gp");
      }
    }

    // Update the event status to "Concluded"
    const { error: updateEventStatusError } = await supabase
      .from("events")
      .update({ status: "Concluded" })
      .eq("id", eventid);

    if (updateEventStatusError) {
      console.error("Error updating event status:", updateEventStatusError.message);
      return res.status(500).send("Error updating event status");
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-eventreg-status", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const { applicationId, registered } = req.body; // Capture application ID and new status from the form

  try {
    // Update the status of the specific registration in the database
    const { data: registration, error: updateStatusError } = await supabase
      .from("events_registrations")
      .update({ registered })
      .eq("id", applicationId)
      .single();

    if (updateStatusError) {
      console.error("Error updating status:", updateStatusError.message);
      return res.status(500).send("Error updating status");
    }

    // Fetch the event registration details using the applicationId
    const { data: eventRegistration, error: eventRegistrationError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (eventRegistrationError) {
      console.error("Error fetching event registration:", eventRegistrationError.message);
      return res.status(500).send("Error fetching event registration");
    }

    // Add a notification for the user about their event registration status
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("username")
      .eq("id", eventRegistration.userid)
      .single();

    if (userError) {
      console.error("Error fetching user:", userError.message);
      return res.status(500).send("Error fetching user");
    }

    // Fetch the event details from the events table
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventRegistration.eventid)
      .single();

    if (eventError) {
      console.error("Error fetching event details:", eventError.message);
      return res.status(500).send("Error fetching event details");
    }

    const notificationMessage = registered === "true" 
      ? `Your registration for the event ${event.name} has been accepted.` 
      : `Your registration for the event ${event.name} has been rejected.`;

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          userid: eventRegistration.userid,
          type: "Event",
          message: notificationMessage,
          desc: `You are now listed to compete at ${event.name}. Take note of your check-in code for easy entry`,
        },
      ]);

    if (notificationError) {
      console.error("Error creating notification:", notificationError.message);
      return res.status(500).send("Error creating notification");
    }

    console.log("Registration updated:", registration);
    res.redirect(`/events-review-registration/${applicationId}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/follow-topic/:id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userId = req.session.user.id;
  const topicId = req.params.id;

  try {
    // Fetch the current followers array
    const { data: topic, error: fetchError } = await supabase
      .from("forum_topics")
      .select("followers")
      .eq("id", topicId)
      .single();

    if (fetchError) {
      return res.status(500).send("Error fetching topic followers");
    }

    // Add the current user to the followers array if not already in it
    const updatedFollowers = topic.followers || [];
    if (!updatedFollowers.includes(userId)) {
      updatedFollowers.push(userId);
    }

    // Update the topic with the new followers array
    const { data, error: updateError } = await supabase
      .from("forum_topics")
      .update({ followers: updatedFollowers })
      .eq("id", topicId);

    if (updateError) {
      return res.status(500).send("Error following topic");
    }

    res.redirect("/forum");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/unfollow-topic/:id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  const userId = req.session.user.id;
  const topicId = req.params.id;

  try {
    // Fetch the current followers array
    const { data: topic, error: fetchError } = await supabase
      .from("forum_topics")
      .select("followers")
      .eq("id", topicId)
      .single();

    if (fetchError) {
      return res.status(500).send("Error fetching topic followers");
    }

    // Remove the current user from the followers array if present
    const updatedFollowers = (topic.followers || []).filter(
      (follower) => follower !== userId
    );

    // Update the topic with the new followers array
    const { data, error: updateError } = await supabase
      .from("forum_topics")
      .update({ followers: updatedFollowers })
      .eq("id", topicId);

    if (updateError) {
      return res.status(500).send("Error unfollowing topic");
    }

    res.redirect("/forum");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/delete-topic/:id", async (req, res) => {
  

  const topicId = req.params.id;

  try {
    const { error } = await supabase
      .from("forum_topics")
      .delete()
      .eq("id", topicId);

    if (error) {
      console.error("Error deleting topic:", error.message);
      return res.status(500).send("Error deleting topic");
    }

    res.redirect("/forum"); // Redirect after successful deletion
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send("Server error");
  }
});

app.post('/update-activity/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, date, time } = req.body;

  const { error } = await supabase
      .from('club_activities')
      .update({ name, description, date, time })
      .eq('id', id);

  if (error) {
      console.error("Error updating activity:", error);
      res.status(500).send("Error updating activity");
  } else {
      const { data: updatedActivity, fetchError } = await supabase
          .from('club_activities')
          .select('clubid')
          .eq('id', id)
          .single();

      if (fetchError) {
          console.error("Error fetching updated activity:", fetchError);
          res.status(500).send("Error fetching updated activity");
      } else {
          const clubId = updatedActivity.clubid; 
          res.redirect(`/clubs-details/${clubId}#activity`);
      }
  }
});

app.post('/delete-activity/:id', async (req, res) => {
  const { id } = req.params;
  const { clubid } = req.body;

  const { data, error } = await supabase
      .from('club_activities')
      .delete()
      .eq('id', id);

  if (error) {
      console.error("Error deleting activity:", error);
      res.status(500).send("Error deleting activity");
  } else {
      console.log("Activity deleted:", data);
      res.redirect(`/clubs-details/${clubid}`);
  }
});

app.post("/create-announcement", async (req, res) => {
  const { title, subject, body, clubid } = req.body;

  if (!req.session || !req.session.user) {
    return res.status(403).send("User not authenticated");
  }

  const originalposter = req.session.user.username;
  const profilepic = req.session.user.profilepic;

  if (!clubid) {
    return res.status(400).send("Club ID is missing");
  }

  try {
    // Log the data being inserted for debugging purposes
    console.log({
      title,
      subject,
      body,
      clubid: parseInt(clubid),
      originalposter,
      profilepic
    });

    // Insert the new announcement into 'club_announcements' table
    const { data, error } = await supabase
      .from("club_announcements")
      .insert([
        {
          title,
          subject,
          body,
          clubid: parseInt(clubid),
          originalposter,
          profilepic
        },
      ]);

    if (error) {
      console.error("Error creating announcement:", error.message);
      return res.status(500).send("Error creating announcement");
    }

    // Redirect back to the club details page after successful insertion
    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server error while creating announcement");
  }
});

app.post("/create-club-activity", async (req, res) => {
  const { name, description, date, time, clubid } = req.body;

  // Check if the user is authenticated
  if (!req.session || !req.session.user) {
    console.error("User not authenticated");
    return res.status(403).send("User not authenticated");
  }

  const createdby = req.session.user.id; // Get the user ID from the session

  // Check if club_id is provided
  if (!clubid) {
    console.error("Club ID is missing in the request");
    return res.status(400).send("Club ID is missing");
  }

  try {
    // Log the data being inserted for debugging purposes
    console.log({
      name,
      description,
      date,
      time,
      createdby,
      clubid
    });

    // Insert the new activity into the 'activities' table
    const { data, error } = await supabase
      .from("club_activities")
      .insert([
        {
          name,
          description,
          date,
          time,
          createdby,
          clubid
        },
      ]);

    if (error) {
      console.error("Error creating activity:", error.message);
      return res.status(500).send("Error creating activity");
    }

    // Fetch users who are part of the club
    const { data: clubMembers, error: clubMembersError } = await supabase
      .from("users")
      .select("id")
      .eq("clubid", clubid);

    if (clubMembersError) {
      console.error("Error fetching club members:", clubMembersError.message);
      return res.status(500).send("Error fetching club members");
    }

    // Create notifications for each club member
    if (clubMembers.length > 0) {
      const notifications = clubMembers.map(member => ({
        userid: member.id,
        type: "Club",
        message: `New activity created: ${name}`,
        desc: `A new activity "${name}" has been created in your club. Check it out!`,
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Error creating notifications:", notificationError.message);
        return res.status(500).send("Error creating notifications");
      }
    } else {
      console.error("No club members found to notify.");
    }

    // Redirect back to the club details page after successful insertion
    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error while creating activity:", error.message);
    res.status(500).send("Server error while creating activity");
  }
});

app.post("/attend-activity", async (req, res) => {
  const { activityId } = req.body;
  const userId = req.session.user.id;

  try {
      const { data, error } = await supabase
          .from("activity_attendance")
          .insert([{ activity_id: activityId, user_id: userId, status: "Attending" }]);
      if (error) throw error;

      res.redirect(`/clubs-details/${req.body.club_id}`);
  } catch (error) {
      console.error("Error attending activity:", error.message);
      res.status(500).send("Error attending activity");
  }
});

app.post("/rsvp-activity", async (req, res) => {
  const { activityId, going } = req.body;
  const userId = req.session.user.id; // Assuming the user is logged in

  try {
    // Fetch the current attendees for the activity
    const { data: activity, error } = await supabase
      .from("club_activities")
      .select("attendees")
      .eq("id", activityId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    let attendees = activity.attendees || [];

    if (going) {
      // Add the user if they're not already in the attendees list
      if (!attendees.includes(userId)) {
        attendees.push(userId);
      }
    } else {
      // Remove the user if they clicked "I'm Not Going"
      attendees = attendees.filter(id => id !== userId);
    }

    // Update the attendees field
    const { error: updateError } = await supabase
      .from("club_activities")
      .update({ attendees })
      .eq("id", activityId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.status(200).json({ message: "RSVP updated successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/update-club", upload.single("clubpicture"), async (req, res) => {
  const {
    clubid,
    clubname,
    clubaddress,
    email,
    phonenum,
    region,
    description,
    existingClubPicture // The hidden input from the form
  } = req.body;

  // Set `clubpicUrl` to the existing picture by default
  let clubpicUrl = existingClubPicture;

  if (req.file) {
    // If a new file is uploaded, update `clubpicUrl` with the new file URL
    try {
      const filePath = `clubpictures/${Date.now()}-${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        console.error("Error uploading club picture:", uploadError.message);
        return res.status(500).send("Error uploading club picture");
      }

      clubpicUrl = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
    } catch (error) {
      console.error("Server error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  try {
    // Update the club in the database with either the new picture or the existing one
    const { data, error } = await supabase
      .from("clubs")
      .update({
        clubname,
        clubaddress,
        email,
        phonenum,
        region,
        description,
        clubpic: clubpicUrl // Use the existing or new picture URL
      })
      .eq("id", clubid);

    if (error) {
      return res.status(500).json({ message: "Error updating club", error });
    }

    res.redirect(`/clubs-details/${clubid}`);
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-event-announcement", async (req, res) => {
  const { title, subject, body, eventid } = req.body;

  if (!req.session.user) {
    return res.status(401).send("Unauthorized: No user logged in");
  }

  try {
    const { error } = await supabase.from("event_announcements").insert([
      {
        title,
        subject,
        body,
        eventid,
      },
    ]);

    if (error) {
      return res.status(500).render("events", {
        error: "Error creating announcement.",
        user: req.session.user,
      });
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-kyorugi-scores", async (req, res) => {
  const { matchid, player1_total, player2_total, eventid, player1, player2, dqreason } =
    req.body;

  const player1score = player1_total;
  const player2score = player2_total;

  let winner, loser;
  if (player1score > player2score) {
    winner = player1;
    loser = player2;
  } else if (player2score > player1score) {
    winner = player2;
    loser = player1;
  } else {
    winner = 0; // In case of a tie
    loser = 0;
  }

  try {
    const { error } = await supabase
      .from("kyorugi_matches")
      .update({ 
        player1score,
        player2score, 
        winner, 
        loser,
        dqreason
      })
      .eq("id", matchid);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    /* await createNextRound(eventid);*/

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-poomsae-scores", async (req, res) => {
  const {
    basicmovement,
    indivmovement,
    balance,
    powerspeed,
    coord,
    energy,
    id,
    eventid,
    totalscore,
    dqreason,
  } = req.body;

  const technicalscore = 4 - parseFloat(basicmovement) - parseFloat(indivmovement) - parseFloat(balance);
  const performancescore = 6 - parseFloat(powerspeed) - parseFloat(coord) - parseFloat(energy);

  try {
    if (parseFloat(totalscore) === -1) {
      // Update the poomsae_players table if the score is -1
      const { error: updatePoomsaePlayerError } = await supabase
        .from("poomsae_players")
        .update({ 
          totalscore: -1,
          dqreason: dqreason,
         })
        .eq("id", id);

      if (updatePoomsaePlayerError) {
        return res.status(400).json({ error: updatePoomsaePlayerError.message });
      }

    } else {
      // Insert scores into judge_scores table
      // Check if the judge has already scored the player
      const { data: existingScore, error: existingScoreError } = await supabase
        .from("poomsae_judge_scores")
        .select("*")
        .eq("judgeid", req.session.user.id)
        .eq("poomsaeplayerid", id)
        .single();

      if (existingScoreError && existingScoreError.code !== 'PGRST116') {
        return res.status(400).json({ error: existingScoreError.message });
      }

      if (existingScore) {
        // Update the existing score
        const { error: updateScoreError } = await supabase
          .from("poomsae_judge_scores")
          .update({
            techscore: technicalscore,
            performancescore: performancescore,
            totalscore: parseFloat(totalscore),
          })
          .eq("id", existingScore.id);

        if (updateScoreError) {
          return res.status(400).json({ error: updateScoreError.message });
        }
      } else {
        // Insert a new score
        const { error: judgeScoresError } = await supabase
          .from("poomsae_judge_scores")
          .insert([
            {
              judgeid: req.session.user.id, // Assuming the judge ID is the current user's ID
              poomsaeplayerid: id,
              techscore: technicalscore,
              performancescore: performancescore,
              totalscore: parseFloat(totalscore),
            },
          ]);

        if (judgeScoresError) {
          return res.status(400).json({ error: judgeScoresError.message });
        }
      }

      // Calculate the average total score for the poomsae player
      const { data: judgescores, error: judgescoresError } = await supabase
        .from("poomsae_judge_scores")
        .select("totalscore")
        .eq("poomsaeplayerid", id);

      if (judgescoresError) {
        return res.status(400).json({ error: judgescoresError.message });
      }

      const totalScores = judgescores.map(score => score.totalscore);
      const averageTotalScore = totalScores.reduce((acc, score) => acc + score, 0) / totalScores.length;

      // Update the poomsae_players table with the average total score
      const { error: updatePoomsaePlayerError } = await supabase
        .from("poomsae_players")
        .update({ totalscore: averageTotalScore, dqreason: dqreason })
        .eq("id", id);

      if (updatePoomsaePlayerError) {
        return res.status(400).json({ error: updatePoomsaePlayerError.message });
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-grade-sheet", async (req, res) => {
  const {
    id,
    eventid,
    form,
    selfdef,
    kicking,
    freesparring,
    basicmove,
    behavior,
    breaking,
  } = req.body;

  try {
    // Update the grade sheet in the promotion_players table
    const { error } = await supabase
      .from("promotion_players")
      .update({
        form,
        selfdef,
        kicking,
        freesparring,
        basicmove,
        behavior,
        breaking,
      })
      .eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Error submitting grade sheet:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-matchtime", async (req, res) => {
  const { id, matchtime, eventid } = req.body;

  try {
    // Fetch the current match details to compare the matchtime
    const { data: currentMatch, error: currentMatchError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("id", id)
      .single();

    if (currentMatchError) {
      return res.status(400).json({ error: currentMatchError.message });
    }

    // Update the matchtime in the matches table
    const { error } = await supabase
      .from("kyorugi_matches")
      .update({ matchtime })
      .eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Only create notifications if the matchtime has changed
    if (currentMatch.matchtime !== matchtime) {
      // Create notifications for both players
      // Fetch the event name
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventid)
        .single();

      if (eventError) {
        console.error("Error fetching event name:", eventError.message);
        return res.status(500).send("Error fetching event name");
      }

      const notifications = [
        {
          userid: currentMatch.player1,
          type: "Event",
          message: `Your match time for ${event.name} has been updated to ${matchtime}.`,
          desc: `Please be ready for your match at the new scheduled time.`,
        },
        {
          userid: currentMatch.player2,
          type: "Event",
          message: `Your match time for ${event.name} has been updated to ${matchtime}.`,
          desc: `Please be ready for your match at the new scheduled time.`,
        },
      ];

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Error creating notifications:", notificationError.message);
        return res.status(500).send("Error creating notifications");
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Error updating matchtime:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-performance-sched", async (req, res) => {
  const { id, schedule, eventid } = req.body;

  try {
    // Fetch the current performance details to compare the schedule
    const { data: currentPerformance, error: currentPerformanceError } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("id", id)
      .single();

    if (currentPerformanceError) {
      return res.status(400).json({ error: currentPerformanceError.message });
    }

    // Update the schedule in the poomsae_players table
    const { error } = await supabase
      .from("poomsae_players")
      .update({ schedule })
      .eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Only create notifications if the schedule has changed
    if (currentPerformance.schedule !== schedule) {
      // Create notifications for the player
      // Fetch the event name
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventid)
        .single();

      if (eventError) {
        console.error("Error fetching event name:", eventError.message);
        return res.status(500).send("Error fetching event name");
      }

      const notification = {
        userid: currentPerformance.userid,
        type: "Event",
        message: `Your performance time for ${event.name} has been updated to ${schedule}.`,
        desc: `Please be ready for your performance at the new scheduled time.`,
      };

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([notification]);

      if (notificationError) {
        console.error("Error creating notification:", notificationError.message);
        return res.status(500).send("Error creating notification");
      }
    }

    res.redirect(`/events-details/${eventid}`);
  } catch (error) {
    console.error("Error updating performance time:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/update-points", async (req, res) => {
  const { userid, points } = req.body;

  try {
    // Fetch the current ranking points for the user
    const { data: athlete, error: fetchError } = await supabase
      .from("athletes")
      .select("rankingpoints")
      .eq("userid", userid)
      .single();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    // Calculate the new total points
    const currentPoints = athlete.rankingpoints || 0;
    const newTotalPoints = currentPoints + parseInt(points, 10);

    // Update the ranking points for the user
    const { error: updateError } = await supabase
      .from("athletes")
      .update({ rankingpoints: newTotalPoints })
      .eq("userid", userid);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.redirect("back"); // Redirect back to the previous page
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/update-athlete-status', async (req, res) => {
  const { id, status } = req.body;

  try {
    // Update the status in the database using Supabase
    const { error } = await supabase
      .from('athletes') // Ensure this table name matches your actual table name
      .update({ status: status })
      .eq('id', id); // Ensure you're updating the correct row based on the athlete ID

    if (error) {
      console.error('Error updating status:', error);
      return res.status(500).json({ success: false, error: 'Database update failed' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});




// VIEWS BELOW

app.get("/home", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    // Fetch the latest 4 events
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4);

    if (eventsError) {
      return res.status(400).json({ error: eventsError.message });
    }

    // Fetch clubs the user is in
    let userclub = null;
    if(req.session.user.clubid) {
      const { data, error: userclubError } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", req.session.user.clubid)
        .single();

      if (userclubError) {
        return res.status(400).json({ error: userclubError.message });
      }
      userclub = data;
    }

    // Fetch clubs the user registered
    const { data: registeredClubs, error: registeredClubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("registeredby", req.session.user.id);

    if (registeredClubsError) {
      return res.status(400).json({ error: registeredClubsError.message });
    }

     console.log("Fetched clubs user is in:", userclub);
    // console.log("Fetched clubs user registered:", registeredClubs);

    // Fetch the top 3 athletes based on ranking points
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select("name, beltlevel, rankingpoints, portrait")
      .order("rankingpoints", { ascending: false })
      .limit(3);

    if (athletesError) {
      return res.status(400).json({ error: athletesError.message });
    }

    // Fetch events that the user is registered in
    const { data: registeredEvents, error: registeredEventsError } = await supabase
      .from("events_registrations")
      .select("eventid")
      .eq("userid", req.session.user.id)
      .eq("registered", "true");

    if (registeredEventsError) {
      return res.status(400).json({ error: registeredEventsError.message });
    }

    const eventIds = registeredEvents.map((registration) => registration.eventid);

    const { data: userEvents, error: userEventsError } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds);

    if (userEventsError) {
      return res.status(400).json({ error: userEventsError.message });
    }

    console.log("Fetched user registered events:", userEvents);

    console.log("Fetched events:", events);
    console.log("Fetched top athletes:", athletes);

    // Render the home.hbs template with events, top athletes, and the session user data
    res.render("home", { athletes, registeredClubs, userclub, events, userEvents, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/forum", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const userId = req.session.user.id; // Assuming user ID is stored in the session

  try {
    // Fetch all topics
    const { data: topics, error: topicsError } = await supabase
      .from("forum_topics")
      .select("*");

    if (topicsError) {
      return res.status(400).json({ error: topicsError.message });
    }

    // Mark topics as followed or not followed by the current user
    const markedTopics = topics.map((topic) => {
      const followers = topic.followers || []; // Ensure followers is an array
      topic.followed = followers.includes(userId);
      return topic;
    });

    // Fetch threads that belong to the followed topics
    const followedTopicIds = markedTopics
      .filter((topic) => topic.followed)
      .map((topic) => topic.id);
    const { data: threads, error: threadsError } = await supabase
      .from("forum_threads")
      .select("*")
      .in("topicid", followedTopicIds);

    if (threadsError) {
      return res.status(400).json({ error: threadsError.message });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("ptaverified")
      .eq("id", userId)
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // Determine if the user is an admin based on ptaverified
    const isAdmin = userData.ptaverified === true;

    console.log("Fetched threads:", threads); // Log the threads data to the console
    console.log("Fetched topics:", markedTopics); // Log the topics data to the console

    // Render the forum.hbs template with the fetched data
    res.render("forum", {
      forum_threads: threads,
      forum_topics: markedTopics,
      user: { ...req.session.user, isAdmin },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/forum-create", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data: threads, error: threadsError } = await supabase
      .from("forum_threads")
      .select("*");

    if (threadsError) {
      return res.status(400).json({ error: threadsError.message });
    }

    const { data: topics, error: topicsError } = await supabase
      .from("forum_topics")
      .select("*");

    if (topicsError) {
      return res.status(400).json({ error: topicsError.message });
    }

    console.log("Fetched threads data:", threads); // Log the threads data to the console
    console.log("Fetched topics data:", topics); // Log the topics data to the console

    // Render the forum-create.hbs template with the fetched data
    res.render("forum-create", {
      forum_threads: threads,
      forum_topics: topics,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/forum-thread/:id", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const threadId = req.params.id;

  try {
    // Fetch the specific thread data
    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .select("*")
      .eq("id", threadId)
      .single();

    if (threadError) {
      return res.status(400).json({ error: threadError.message });
    }

    console.log("Fetched thread data:", thread);

    // Fetch the comments for this thread
    const { data: comments, error: commentsError } = await supabase
      .from("forum_comments")
      .select("*")
      .eq("threadid", threadId);

    if (commentsError) {
      return res.status(400).json({ error: commentsError.message });
    }

    console.log("Fetched comments data:", comments);

    // Render the forum-thread.hbs template with the fetched data
    res.render("forum-thread", { thread, comments, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to render the main clubs page
app.get("/clubs", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data: clubs, error } = await supabase
      .from("clubs")
      .select("*");

    if (error) {
      console.error("Error fetching clubs:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const userId = req.session.user.id; // Assuming user ID is stored in the session

    const { data: ownedclub, error: ownedclubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("registeredby", userId);

    if (ownedclubError) {
      return res.status(400).json({ error: ownedclubError.message });
    }


    const userClubId = req.session.user.clubid; // Assuming clubid is stored in the session

    let userClub = null;
    if (userClubId) {
      const { data: fetchedUserClub, error: userClubError } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", userClubId)
        .single();

      if (userClubError) {
        return res.status(400).json({ error: userClubError.message });
      }

      userClub = fetchedUserClub;
    }

    console.log("Fetched user's club:", userClub); // Log the user's club data to the console

    // const { data: userClub, error: userClubError } = await supabase
    //   .from("clubs")
    //   .select("*")
    //   .eq("id", userClubId)
    //   .single();

    // if (userClubError) {
    //   return res.status(400).json({ error: userClubError.message });
    // }

    console.log("Fetched user's club:", userClub); // Log the user's club data to the console

    res.render("clubs", { 
      clubs,
      ownedclub,
      userClub,
      user: req.session.user,
     });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});


app.get("/clubs-details/:id", async function (req, res) {
  const { id } = req.params;

  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    // Fetch the club, owner, and other details
    const { data: club, error: clubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", id)
      .single();

    if (clubsError) {
      return res.status(400).json({ clubsError: clubsError.message });
    }

    const { data: clubOwner, error: clubOwnerError } = await supabase
      .from("users")
      .select("*")
      .eq("id", club.registeredby)
      .single();

    if (clubOwnerError) {
      return res.status(400).json({ clubOwnerError: clubOwnerError.message });
    }

    const { data: allUsers, error: allUsersError } = await supabase
      .from("users")
      .select("*");

    if (allUsersError) {
      return res.status(400).json({ allUsersError: allUsersError.message });
    }

    const { data: athletes, error: athleteserror } = await supabase
      .from("athletes")
      .select("*");

    if (athleteserror) {
      return res.status(400).json({ athleteserror: athleteserror.message });
    }

    const { data: announcements, error: announcementserror } = await supabase
      .from("club_announcements")
      .select("*")
      .eq("clubid", id);

    if (announcementserror) {
      return res.status(400).json({ announcementserror: announcementserror.message });
    }

    const { data: club_requests, error: club_requestsError } = await supabase
      .from("club_requests")
      .select("*")
      .eq("clubid", id);

    if (club_requestsError) {
      return res.status(400).json({ club_requestsError: club_requestsError.message });
    }

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*");

    if (usersError) {
      return res.status(400).json({ usersError: usersError.message });
    }

    // Merge user data with club requests
    const clubRequestsWithUserDetails = club_requests.map((request) => {
      const user = users.find((user) => user.id === request.userid);
      return {
        ...request,
        firstname: user ? user.firstname : null,
        lastname: user ? user.lastname : null,
      };
    });

    const { data: clubMembers, error: clubMembersError } = await supabase
      .from("users")
      .select("*")
      .eq("clubid", club.id);

    if (clubMembersError) {
      return res.status(400).json({ error: clubMembersError.message });
    }

    const clubMembersWithAthleteData = clubMembers.map((member) => {
      const athlete = athletes.find((athlete) => athlete.userid === member.id);
      return {
        ...member,
        athleteData: athlete || null,
      };
    });

    const { data: clubactivities, error: clubactivitiesError } = await supabase
      .from("club_activities")
      .select("*")
      .eq("clubid", id)
      .order("created_at", { ascending: false });

    if (clubactivitiesError) {
      return res.status(400).json({ clubactivitiesError: clubactivitiesError.message });
    }

    const { data: attendees, error: attendeesError } = await supabase
      .from("users")
      .select("id, firstname, lastname");

    if (attendeesError) {
      return res.status(400).json({ attendeesError: attendeesError.message });
    }

    // Calculate attendance count for each member
    const attendanceCounts = {};
    clubactivities.forEach((activity) => {
      (activity.attendees || []).forEach((attendeeId) => {
        if (attendanceCounts[attendeeId]) {
          attendanceCounts[attendeeId]++;
        } else {
          attendanceCounts[attendeeId] = 1;
        }
      });
    });

    // Add attendance count to each club member
    const clubMembersWithAttendanceData = clubMembersWithAthleteData.map((member) => ({
      ...member,
      attended_count: attendanceCounts[member.id] || 0, // Set count or default to 0 if no attendance
    }));

    const clubActivitiesWithUserDetails = clubactivities.map((activity) => {
      const attendeesWithDetails = (activity.attendees || []).map((attendeeId) => {
        const user = attendees.find((user) => user.id === attendeeId);
        return user ? { id: user.id, firstname: user.firstname, lastname: user.lastname } : null;
      }).filter((attendee) => attendee !== null);

      return {
        ...activity,
        attendees: attendeesWithDetails,
      };
    });

    console.log("clubactivitieswithuserdetails", clubActivitiesWithUserDetails);

    // Render the clubs-details.hbs template with the fetched data
    res.render("clubs-details", {
      club,
      clubOwner,
      allUsers,
      clubMembersWithAthleteData: clubMembersWithAttendanceData, // Use updated data with attendance count
      announcements,
      club_requests,
      clubRequestsWithUserDetails,
      clubactivities,
      clubActivitiesWithUserDetails,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/activity-attendees/:activityId", async (req, res) => {
  const { activityId } = req.params;

  try {
    // Fetch the activity to get the list of attendee IDs
    const { data: activity, error: activityError } = await supabase
      .from("club_activities")
      .select("attendees")
      .eq("id", activityId)
      .single();

    if (activityError) {
      return res.status(400).json({ error: activityError.message });
    }

    const attendeeIds = activity.attendees || [];

    // Fetch the names of attendees
    const { data: attendees, error: attendeesError } = await supabase
      .from("users") // Replace with your user table name
      .select("id, firstname, lastname")
      .in("id", attendeeIds);

    if (attendeesError) {
      return res.status(400).json({ error: attendeesError.message });
    }

    res.status(200).json(attendees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/edit-activity/:id', async (req, res) => {
  const { id } = req.params;

  const { data: activity, error } = await supabase
      .from('club_activities')
      .select('*')
      .eq('id', id)
      .single();

  if (error) {
      console.error("Error fetching activity:", error);
      res.status(500).send("Error fetching activity");
  } else {
      res.render('edit-activity', { activity });
  }
});

app.get("/clubs-manage", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase
      .from("clubs") //need to change to clubs after
      .select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    // Render the forum.hbs template with the fetched data
    res.render("clubs-manage", { clubs: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message, user: req.session.user });
  }
});

app.get("/membership", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase
      .from("clubs") //need to change to clubs after
      .select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    // Render the forum.hbs template with the fetched data
    res.render("membership", { clubs: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message, user: req.session.user });
  }
});

app.get("/events", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase
      .from("events") //need to change to clubs after
      .select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    // Render the forum.hbs template with the fetched data
    res.render("events", { events: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/events-create/:type", async function (req, res) {
  const { type } = req.params; // Correctly capture the type parameter

  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase.from("events").select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    const { data: allusers, error: allusersError } = await supabase
      .from("users")
      .select("*")

    if (allusersError) {
      return res.status(400).json({ error: allusersError.message });
    }

    console.log("Fetched verified users:", allusers); // Log the verified users data to the console

    // Render the events-create.hbs template with the fetched data
    res.render("events-create", {
      events: data,
      user: req.session.user,
      eventtype: type,
      allusers,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/events-registration/:id", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params; // Get the event ID from the URL
  const userId = req.session.user.id; // Get the user ID from the session

  try {
    // Fetch the event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (eventError) {
      return res.status(400).json({ error: eventError.message });
    }

    // Fetch the athlete details for the current user
    const { data: currentuserathlete, error: currentuserathleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("userid", userId)
      .single();

    if (currentuserathleteError && currentuserathleteError.code !== 'PGRST116') {
      return res.status(400).json({ error: currentuserathleteError.message });
    }

    // Fetch the athlete details for the current user
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select("*");

    if (athletesError) {
      return res.status(400).json({ error: athletesError.message });
    }
    
    const { data: registeredClub, error: registeredClubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("registeredby", userId)
      .single();

    if (registeredClubError && registeredClubError.code !== 'PGRST116') {
      return res.status(400).json({ error: registeredClubError.message });
    }

    let clubMembers = [];
    if (registeredClub) {
      const { data: clubMembersData, error: clubMembersError } = await supabase
        .from("users")
        .select("*")
        .eq("clubid", registeredClub.id);

      if (clubMembersError) {
        return res.status(400).json({ error: clubMembersError.message });
      }
      clubMembers = clubMembersData;
    }
    console.log("Fetched clOOOOOOb members data:", clubMembers);

    console.log("Fetched registered club data THIS OSTHOSTIHIOST:", registeredClub); // Log the registered club data to the console
    // Map athlete data to each of the users
    const clubMembersWithAthleteData = clubMembers.map((member) => {
      const athlete = athletes.find((athlete) => athlete.userid === member.id);
      return {
        ...member,
        athleteData: athlete || null,
      };
    });

    console.log("Fetched club members with athlete data:", clubMembersWithAthleteData); // Log the club members with athlete data to the console

    console.log("Fetched club members data FOR EVENTSREGISTRATION:", clubMembers); // Log the club members data to the console

    res.render("events-registration", {
      event,
      currentuserathlete,
      clubMembers,
      clubMembersWithAthleteData,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/events-review-registration/:id", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params; // Get the event registration ID from the URL
  const userId = req.session.user.id; // Get the user ID from the session

  try {
    // Fetch the event registration details
    const { data: eventregistration, error: eventregError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (eventregError && eventregError.code !== 'PGRST116') {
      return res.status(400).json({ error: eventregError.message });
    }

    const { data: registeredathlete, error: registeredathleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("id", eventregistration?.athleteid)
      .single();

    if (registeredathleteError && registeredathleteError.code !== 'PGRST116') {
      return res.status(400).json({ error: registeredathleteError.message });
    }

    console.log("Fetched athlete portrait:", eventregistration?.athleteid);

    // Fetch the event details using the eventid from the event registration
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventregistration?.eventid)
      .single();

    if (eventError && eventError.code !== 'PGRST116') {
      return res.status(400).json({ error: eventError.message });
    }

    // Fetch the athlete details for the current user
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("userid", userId)
      .single();

    if (athleteError && athleteError.code !== 'PGRST116') {
      return res.status(400).json({ error: athleteError.message });
    }

    res.render("events-review-registration", {
      eventregistration,
      event,
      athlete,
      user: req.session.user,
      registeredathlete
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/events-details/:id", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params; // Get the event ID from the URL
  const userId = req.session.user.id; // Get the user ID from the session

  try {
    // Fetch the event details from the events table
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (eventError) {
      return res.status(400).json({ error: eventError.message });
    }

    // Fetch the judges for the specific event
    const { data: judges, error: judgesError } = await supabase
      .from("users")
      .select("id, firstname, lastname")
      .in("id", event.judges);

    if (judgesError) {
      return res.status(400).json({ error: judgesError.message });
    }

    const judgesNames = judges.map(judge => `${judge.firstname} ${judge.lastname}`);

    // Fetch the event registrations for the specific event
    const { data: eventregistrations, error: eventregistrationsError } =
      await supabase
      .from("events_registrations")
      .select("*")
      .eq("eventid", id);

    if (eventregistrationsError) {
      return res.status(400).json({ error: eventregistrationsError.message });
    }

    const { data: pendingregs, error: pendingregsError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("eventid", id)
      .eq("registered", "false")
      .order("created_at", { ascending: true });

    if (pendingregsError) {
      return res.status(400).json({ error: pendingregsError.message });
    }

    // Fetch the participants for the specific event
    const { data: participants, error: participantsError } = await supabase
      .from("events_registrations")
      .select("*")
      .eq("registered", "true")
      .eq("eventid", id);

    if (participantsError) {
      return res.status(400).json({ error: participantsError.message });
    }

    // Check if the current user is already registered for the event
    const { data: currentregistrant, error: currentregistrantError } =
      await supabase
        .from("events_registrations")
        .select("*")
        .eq("userid", userId)
        .eq("eventid", id)
        .single(); // Use .single() since we're checking for a specific user's registration

    if (currentregistrantError && currentregistrantError.code !== "PGRST116") {
      // PGRST116 indicates no rows found, which is okay in this context
      return res.status(400).json({ error: currentregistrantError.message });
    }

    // Fetch the matches for the specific event and order them by id
    const { data: matches, error: matchesError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", id)
      .order("id", { ascending: true });

    if (matchesError) {
      return res.status(400).json({ error: matchesError.message });
    }
    // Fetch kyorugi matches and combine with athlete data
    const { data: kyorugiMatches, error: kyorugiMatchesError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", id);

    if (kyorugiMatchesError) {
      return res.status(400).json({ error: kyorugiMatchesError.message });
    }

    // Fetch athlete data for player1 and player2
    const playerIds = [
      ...new Set([
      ...kyorugiMatches.map((match) => match.player1),
      ...kyorugiMatches.map((match) => match.player2),
      ]),
    ];
    
    const { data: eventannouncements } = await supabase
      .from("event_announcements")
      .select("*")
      .eq("eventid", id)
      .order("id", { ascending: true });

    if (matchesError) {
      return res.status(400).json({ error: matchesError.message });
    }

    // Fetch player names and winner names for each match
    for (let match of matches) {
      if (match.player1) {
        const { data: player1, error: player1Error } = await supabase
          .from("athletes")
          .select("name")
          .eq("userid", match.player1)
          .single();

        if (player1Error) {
          return res
            .status(400)
            .json({ error: "Error fetching player1 name." });
        }

        match.player1_name = player1.name;
      }

      if (match.player2) {
        const { data: player2, error: player2Error } = await supabase
          .from("athletes")
          .select("name")
          .eq("userid", match.player2)
          .single();

        if (player2Error) {
          return res
            .status(400)
            .json({ error: "Error fetching player2 name." });
        }

        match.player2_name = player2.name;
      }

      if (match.winner) {
        const { data: winner, error: winnerError } = await supabase
          .from("athletes")
          .select("name")
          .eq("userid", match.winner)
          .single();

        if (winnerError) {
          return res.status(400).json({ error: "Error fetching winner name." });
        }

        match.winner_name = winner.name;
      } else {
        match.winner_name = "TBD"; // Or set to an appropriate default value
      }
    }

    // Determine the champion, second place, and third place
    let champion = null;
    let secondPlace = null;
    let thirdPlace1 = null;
    let thirdPlace2 = null;

    if (matches.length > 0) {
      const finalMatch = matches.find((match) => match.matchtype === "final");
      if (finalMatch && finalMatch.winner) {
      const { data: finalWinner, error: finalWinnerError } = await supabase
        .from("athletes")
        .select("id, name, userid")
        .eq("userid", finalMatch.winner)
        .single();

      if (finalWinnerError) {
        return res.status(400).json({ error: "Error fetching champion name." });
      }

      champion = finalWinner;

      // Determine second place (loser of the final match)
      const secondPlaceId =
        finalMatch.winner === finalMatch.player1
        ? finalMatch.player2
        : finalMatch.player1;
      const { data: secondPlaceAthlete, error: secondPlaceError } = await supabase
        .from("athletes")
        .select("id, name, userid")
        .eq("userid", secondPlaceId)
        .single();

      if (secondPlaceError) {
        return res.status(400).json({ error: "Error fetching second place name." });
      }

      const isDisqualified = finalMatch.player1score === -1 || finalMatch.player2score === -1;
      secondPlace = { ...secondPlaceAthlete, isDisqualified };

      const { data: highestRound, error: highestRoundError } = await supabase
        .from("kyorugi_matches")
        .select("round")
        .eq("eventid", id)
        .order("round", { ascending: false })
        .limit(1)
        .single();

      if (highestRoundError) {
        return res.status(400).json({ error: highestRoundError.message });
      }

      const currentRound = highestRound ? highestRound.round : 0;

      // Determine third place (losers of the semifinal matches)
      const semifinalMatches = matches.filter((match) => match.round === currentRound - 1);
      if (semifinalMatches.length >= 2) {
        const loser1Id = semifinalMatches[0].winner === semifinalMatches[0].player1 ? semifinalMatches[0].player2 : semifinalMatches[0].player1;
        const loser2Id = semifinalMatches[1].winner === semifinalMatches[1].player1 ? semifinalMatches[1].player2 : semifinalMatches[1].player1;

        const { data: thirdPlaceAthlete1, error: thirdPlaceError1 } = await supabase
        .from("athletes")
        .select("id, name, userid")
        .eq("userid", loser1Id)
        .single();

        if (thirdPlaceError1) {
        return res.status(400).json({ error: "Error fetching third place name." });
        }

        const { data: thirdPlaceAthlete2, error: thirdPlaceError2 } = await supabase
        .from("athletes")
        .select("id, name, userid")
        .eq("userid", loser2Id)
        .single();

        if (thirdPlaceError2) {
        return res.status(400).json({ error: "Error fetching third place name." });
        }

        const isDisqualified1 = semifinalMatches[0].player1score === -1 || semifinalMatches[0].player2score === -1;
        const isDisqualified2 = semifinalMatches[1].player1score === -1 || semifinalMatches[1].player2score === -1;

        thirdPlace1 = { ...thirdPlaceAthlete1, isDisqualified: isDisqualified1 };
        thirdPlace2 = { ...thirdPlaceAthlete2, isDisqualified: isDisqualified2 };
      }
      }
    }

    console.log("Second Place:", secondPlace);
    console.log("Third Place 1:", thirdPlace1);
    console.log("Third Place 2:", thirdPlace2);
    
    let query = supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("eventid", id);

    if (champion) {
      query = query.neq("loser", champion.userid)
    }
    if (secondPlace) {
      query = query.neq("loser", secondPlace.userid);
    }
    if (thirdPlace1) {
      query = query.neq("loser", thirdPlace1.userid);
    }
    if (thirdPlace2) {
      query = query.neq("loser", thirdPlace2.userid);
    }

    const { data: otherPlayers, error: otherPlayersError } = await query;

    if (otherPlayersError) {
      return res.status(400).json({ error: otherPlayersError.message });
    }

    const { data: losers, error: losersError } = await supabase
      .from("athletes")
      .select("*")
      .in("userid", otherPlayers.map(player => player.loser).filter(loser => loser !== null));

    if (losersError) {
      return res.status(400).json({ error: losersError.message });
    }

    const otherPlayersWithDetails = otherPlayers.map(player => {
      const loserDetails = losers.find(user => user.userid === player.loser);
      const isDisqualified = player.player1score === -1 || player.player2score === -1;
      return {
      ...player,
      loserDetails: loserDetails || null,
      isDisqualified,
      };
    }).filter(player => player.isDisqualified || player.loserDetails);

    console.log("Ffefefefetch data:", otherPlayersWithDetails); 

    // Fetch the poomsae players for the specific event
    const { data: poomsaePlayers, error } = await supabase
      .from('poomsae_players')
      .select('*')
      .eq('eventid', id)
      .order('totalscore', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const groupedByRound = poomsaePlayers.reduce((acc, player) => {
      const round = player.round;
      if (!acc[round]) {
      acc[round] = [];
      }
      acc[round].push(player);
      return acc;
    }, {});

    // Sort rounds in descending order
    const sortedGroupedByRound = Object.keys(groupedByRound)
      .sort((a, b) => b - a)
      .reduce((acc, key) => {
      acc[key] = groupedByRound[key];
      return acc;
      }, {});

    // Calculate the number of registrations
    const registrationcount = participants.length;
    // Fetch judge scores for poomsae players
    const { data: judgeScores, error: judgeScoresError } = await supabase
      .from("poomsae_judge_scores")
      .select("*")
      .in("poomsaeplayerid", poomsaePlayers.map(player => player.id));

    if (judgeScoresError) {
      return res.status(400).json({ error: judgeScoresError.message });
    }

    // Calculate average total score for each poomsae player
    const playerScoresMap = judgeScores.reduce((acc, score) => {
      if (!acc[score.poomsaeplayerid]) {
      acc[score.poomsaeplayerid] = [];
      }
      acc[score.poomsaeplayerid].push(score.totalscore);
      return acc;
    }, {});

    Object.keys(playerScoresMap).forEach(playerId => {
      const scores = playerScoresMap[playerId];
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      playerScoresMap[playerId] = averageScore;
    });

    // Map average scores to poomsae players in sortedGroupedByRound
    Object.keys(sortedGroupedByRound).forEach(round => {
      sortedGroupedByRound[round] = sortedGroupedByRound[round].map(player => {
      const averageScore = playerScoresMap[player.id] || 0;
      return {
        ...player,
        averageScore,
      };
      });
    });

    console.log("Grouped Poomsae Players with Judge Scores:", sortedGroupedByRound);

    // Fetch the top 4 players with the highest totalscore
    const { data: poomsaetop4, error: poomsaetop4Error } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("eventid", id)
      .in("ranking", [1, 2, 3, 4])
      .order("totalscore", { ascending: false });

    if (poomsaetop4Error) {
      return res.status(400).json({ error: poomsaetop4Error.message });
    }

    const { data: poomsaenontop4, error: poomsaenontop4Error } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("eventid", id)
      .eq("ranking", 0)
      .order("totalscore", { ascending: false });

    if (poomsaenontop4Error) {
      return res.status(400).json({ error: poomsaenontop4Error.message });
    }

    // Fetch athlete data of the current user
    const { data: currentUserAthlete, error: currentUserAthleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("userid", userId)
      .single();

    if (currentUserAthleteError && currentUserAthleteError.code !== "PGRST116") {
      // PGRST116 indicates no rows found, which is okay in this context
      return res.status(400).json({ error: currentUserAthleteError.message });
    }

    // Fetch the club registered by the current user
    const { data: registeredClub, error: registeredClubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("registeredby", userId)
      .single();

    if (registeredClubError && registeredClubError.code !== 'PGRST116') {
      return res.status(400).json({ error: registeredClubError.message });
    }

    let clubMembers = [];
    if (registeredClub) {
      const { data: clubMembersData, error: clubMembersError } = await supabase
      .from("users")
      .select("*")
      .eq("clubid", registeredClub.id);

      if (clubMembersError) {
      return res.status(400).json({ error: clubMembersError.message });
      }
      clubMembers = clubMembersData;
    }

    console.log("Fetched club members data:", clubMembers);
    console.log("Fetched club members data:", clubMembers); // Log the club members data to the console

    // PROMOTION PART OF THIS VIEW

    // Fetch promotion players for the specific event
    const { data: promotionplayers, error: promotionplayersError } = await supabase
      .from("promotion_players")
      .select("*")
      .eq("eventid", id);

    if (promotionplayersError) {
      return res.status(400).json({ error: promotionplayersError.message });
    }

    // Fetch athlete data for promotion players
    const athleteIds = promotionplayers.map((player) => player.athleteid);
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select("*")
      .in("id", athleteIds);

    if (athletesError) {
      return res.status(400).json({ error: athletesError.message });
    }

    // Map athlete data to promotion players
    const promotionPlayersWithAthleteData = promotionplayers.map((player) => {
      const athlete = athletes.find((athlete) => athlete.id === player.athleteid);
      return {
        ...player,
        athleteData: athlete || null,
      };
    });

    const { data: allusers, error: allusersError } = await supabase
      .from("users")
      .select("*")

    if (allusersError) {
      return res.status(400).json({ error: allusersError.message });
    }

    console.log("Fetched verified users:", allusers); // Log the verified users data to the console
    console.log("Fetched promotion players with athlete data:", promotionPlayersWithAthleteData); // Log the promotion players with athlete data to the console
    console.log("Fetched promotion players data:", promotionplayers); // Log the promotion players data to the console
    console.log("Fetched current user athlete data:", currentUserAthlete); // Log the current user athlete data to the console
    console.log("Fetched top players data:", poomsaetop4); // Log the top players data to the console
    console.log("Fetched event data:", event); // Log the event data to the console
    console.log("Fetched event registrations data:", eventregistrations); // Log the event registrations data to the console
    console.log("Fetched participants data:", participants); // Log the participants data to the console
    console.log("Fetched current registrant data:", currentregistrant); // Log the current registrant data to the console
    console.log("Fetched matches data:", matches); // Log the matches data to the console
    console.log("Fetched poomsae players data:", poomsaePlayers); // Log the poomsae players data to the console

    // Render the events-details.hbs template with the fetched data
    res.render("events-details", {
      event,
      eventregistrations,
      participants,
      pendingregs,
      currentregistrant,
      matches,
      poomsaePlayers,
      poomsaetop4,
      poomsaenontop4,
      registrationcount,
      registrationcap: event.registrationcap, // Assuming the registration cap is stored in the event table
      user: req.session.user,
      eventannouncements,
      sortedGroupedByRound,
      champion,
      secondPlace,
      thirdPlace1,
      thirdPlace2,
      otherPlayersWithDetails,
      currentUserAthlete,
      promotionplayers,
      promotionPlayersWithAthleteData,
      clubMembers,
      allusers,
      judgesNames,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/profile", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const userId = req.session.user.id;

  try {
    // Check if the user is athlete verified
    const athleteVerified = req.session.user.athleteverified;

    let athlete = null;
    if (athleteVerified) {
      // Fetch the athlete's data
      const { data, error } = await supabase
        .from("athletes")
        .select("*")
        .eq("userid", userId)
        .single();

      if (error) {
        console.error("Error fetching athlete data:", error.message);
        return res.status(500).json({ error: error.message });
      }

      athlete = data;
    }

    // Render the profile template with the user session data and athlete data (if applicable)
    res.render("profile", { user: req.session.user, athlete });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/athletes", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    // First fetch users with their club information
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, club");

    if (usersError) {
      throw usersError;
    }

    // Fetch athletes data with all necessary fields
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select(`
        id,
        name,
        userid,
        beltlevel,
        gp,
        gender,
        agedivision,
        portrait
      `)
      .order("gp", { ascending: false });

    if (athletesError) {
      throw athletesError;
    }

    // Fetch all clubs with their details
    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, clubname")
      .not("clubname", "eq", "EMPTY");

    if (clubsError) {
      throw clubsError;
    }

    // Merge the club information with athletes data
    const athletesWithClub = athletes.map((athlete, index) => {
      const user = users.find(user => user.id === athlete.userid);
      return {
        ...athlete,
        index: index + 1,
        club: user ? user.club : 'No Club' // Add club information from user data
      };
    });

    // Fetch clubs owned by the user
    const { data: ownedClubs, error: ownedClubsError } = await supabase
      .from("clubs")
      .select("*")
      .eq("registeredby", req.session.user.id);

    if (ownedClubsError) {
      return res.status(400).json({ error: ownedClubsError.message });
    }

    console.log("Fetched owned clubs:", ownedClubs); // Log the owned clubs data to the console

    // Log the data to verify it's being fetched correctly
    console.log("Fetched athletes data with clubs:", athletesWithClub);
    console.log("Fetched clubs for filtering:", clubs);

    // Render the athletes page with complete data
    res.render("athletes", {
      athletes: athletesWithClub,
      clubs,
      ownedClubs,
      user: req.session.user
    });

  } catch (error) {
    console.error("Error in athletes route:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/athletes-profile/:athleteid", async function (req, res) {
  const { athleteid } = req.params;

  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    // Fetch athlete data
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("id", athleteid)
      .single();

    if (athleteError) {
      return res.status(400).json({ error: athleteError.message });
    }

    // Fetch match data
    const { data: matchdata, error: matchError } = await supabase
      .from("match_history")
      .select("*")
      .eq("athleteid", athleteid)
      .order("created_at", { ascending: false });

    if (matchError) {
      return res.status(400).json({ error: matchError.message });
    }

    // Fetch the most recent match data
    const { data: recentmatch, error: recentmatchError } = await supabase
      .from("match_history")
      .select("*")
      .eq("athleteid", athleteid)
      .order("created_at", { ascending: false })
      // .limit(1);

    if (recentmatchError) {
      return res.status(400).json({ error: recentmatchError.message });
    }

    // Fetch event details for each match
    const matchDataWithEventDetails = await Promise.all(
      matchdata.map(async (match) => {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", match.eventid)
        .single();

      if (eventError) {
        console.error("Error fetching event details:", eventError.message);
        return { ...match, eventName: null, eventDate: null, eventLocation: null, ageDivision: null, eventType: null };
      }

      return {
        ...match,
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location,
        ageDivision: event.agedivision,
        eventType: event.eventtype,
        dq: match.dq,
      };
      })
    );

    console.log("Fetched athlete data:", athlete); // Log athlete data to the console
    console.log("Fetched match data:", matchdata); // Log match data to the console
    console.log("Fetched recent match data:", recentmatch); // Log recent match data to the console

    // Render the athletes-profile.hbs template with the fetched data
    res.render("athletes-profile", {
      athlete,
      matchdata,
      recentmatch,
      matchDataWithEventDetails,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/notifications", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const userid = req.session.user.id; // Get the current user's username from the session

  try {
    const { data: clubInvitations, error: clubInvitationsError } = await supabase
      .from("club_invitations")
      .select("*")
      .eq("invited_user", userid)
      .is("status", null);

    if (clubInvitationsError) {
      return res.status(400).json({ error: clubInvitationsError.message });
    }

    const { data: notifications, error: notificationsError } = await supabase
      .from("notifications")
      .select("*")
      .eq("userid", userid);

    if (notificationsError) {
      return res.status(400).json({ error: notificationsError.message });
    }

    console.log("Fetched club invitations data:", clubInvitations); // Log the club invitations data to the console
    console.log("Fetched notifications data:", notifications); // Log the notifications data to the console

    // Render the notifications.hbs template with the fetched data
    res.render("notifications", {
      club_invitations: clubInvitations,
      notifications: notifications,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/help-center", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase.from("athletes").select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    // Render the athletes.hbs template with the fetched data
    res.render("help-center", { athletes: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/kyorugi-scoresheet/:matchid", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { matchid } = req.params;

  try {
    // Fetch match details
    const { data: match, error: matchError } = await supabase
      .from("kyorugi_matches")
      .select("*")
      .eq("id", matchid)
      .single();

    if (matchError) {
      return res.status(400).json({ error: matchError.message });
    }

    // Fetch player1 details
    const { data: player1, error: player1Error } = await supabase
      .from("athletes")
      .select("name")
      .eq("userid", match.player1)
      .single();

    if (player1Error) {
      return res.status(400).json({ error: player1Error.message });
    }

    // Fetch player2 details
    const { data: player2, error: player2Error } = await supabase
      .from("athletes")
      .select("name")
      .eq("userid", match.player2)
      .single();

    if (player2Error) {
      return res.status(400).json({ error: player2Error.message });
    }

    console.log("Fetched match data:", match); // Log match data to the console
    console.log("Fetched player1 data:", player1); // Log player1 data to the console
    console.log("Fetched player2 data:", player2); // Log player2 data to the console

    // Render the scoresheet template with the fetched data
    res.render("kyorugi-scoresheet", {
      match,
      player1_name: player1.name,
      player2_name: player2.name,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/poomsae-scoresheet/:id", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params; // Get the group and athlete ID from the URL

  try {
    // Fetch the poomsae group details from the poomsae_players table
    const { data: players, error: playersError } = await supabase
      .from("poomsae_players")
      .select("*")
      .eq("id", id)
      .single(); // Ensure we get a single record

    if (playersError) {
      return res.status(400).json({ error: playersError.message });
    }

    // Fetch athlete details
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("id", players.athleteid)
      .single();

    if (athleteError) {
      return res.status(400).json({ error: athleteError.message });
    }

    console.log("Fetched players data:", players); // Log the players data to the console
    console.log("Fetched athlete data:", athlete); // Log the athlete data to the console

    // Render the poomsae-scoresheet.hbs template with the fetched data
    res.render("poomsae-scoresheet", {
      user: req.session.user,
      players,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//MEMBERSHIP PAGES

app.get("/membership-ncc", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase
      .from("clubs")
      .select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const userClubId = req.session.user.clubid; // Assuming clubid is stored in the session

    let userClub = null;
    let headInstructor = null;

    if (userClubId) {
      const { data: fetchedUserClub, error: userClubError } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", userClubId)
        .single();

      if (userClubError) {
        return res.status(400).json({ error: userClubError.message });
      }

      userClub = fetchedUserClub;

      const { data: fetchedHeadInstructor, error: headInstructorError } = await supabase
        .from("instructor_registrations")
        .select("*")
        .eq("submittedby", userClub.registeredby)
        .single();

      if (headInstructorError) {
        return res.status(400).json({ error: headInstructorError.message });
      }

      headInstructor = fetchedHeadInstructor;
    }

    const { data: usersncc, error: usersnccError } = await supabase
      .from("ncc_registrations")
      .select("*")
      .eq("submittedby", req.session.user.id)
      .single();

    if (usersnccError && usersnccError.code !== 'PGRST116') {
      return res.status(400).json({ error: usersnccError.message });
    }

    const { data: usersathlete, error: usersathleteError } = await supabase
      .from("athletes")
      .select("*")
      .eq("userid", req.session.user.id)
      .single();

    if (usersathleteError && usersathleteError.code !== 'PGRST116') {
      return res.status(400).json({ error: usersathleteError.message });
    }

    console.log("Fetched user's club:", userClub); // Log the user's club data to the console
    console.log("Fetched head instructor:", headInstructor); // Log the head instructor data to the console

    console.log("Fetched data:", data); // Log the data to the console

    // Render the athletes.hbs template with the fetched data
    res.render("membership-ncc", { clubs: data, user: req.session.user, headInstructor, usersncc, usersathlete });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/membership-instructor", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    const { data, error } = await supabase.from("clubs").select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: usersinstructor, error: usersinstructorError } = await supabase
      .from("instructor_registrations")
      .select("*")
      .eq("submittedby", req.session.user.id)
      .single();

    if (usersinstructorError && usersinstructorError.code !== 'PGRST116') {
      return res.status(400).json({ error: usersinstructorError.message });
    }

    console.log("Fetched data:", data); // Log the data to the console

    // Render the athletes.hbs template with the fetched data
    res.render("membership-instructor", {
      clubs: data,
      usersinstructor,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/membership-status", async function (req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const userid = req.session.user.id;
  const ptaverified = req.session.user.ptaverified;

  try {
    let nccData, clubData;
    let nccError, clubError;

    if (ptaverified) {
      
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, athleteverified, instructorverified");

      if (usersError) {
        console.error("Error fetching users:", usersError.message);
        return res.status(500).send("Error fetching users");
      }

      // Fetch all rows if user is 'pta'
      ({ data: nccData, error: nccError } = await supabase
      .from("ncc_registrations")
      .select("*")
      .order("created_at", { ascending: false }));
      nccData = nccData.map((ncc) => {
        const user = users.find((user) => user.id === ncc.submittedby);
        return {
          ...ncc,
          athleteverified: user ? user.athleteverified : null,
        };
      });
      
      ({ data: instData, error: clubError } = await supabase
        .from("instructor_registrations")
        .select("*")
        .order("created_at", { ascending: false }));
      instData = instData.map((inst) => {
        const user = users.find((user) => user.id === inst.submittedby);
        return {
          ...inst,
          instructorverified: user ? user.instructorverified : null,
        };
      });

      console.log("ncc data: ", nccData);
      console.log("inst data: ", instData);

      ({ data: clubData, error: clubError } = await supabase
      .from("club_registrations")
      .select("*")
      .order("created_at", { ascending: false }));

    } else {
      // Fetch only rows submitted by the current user
      ({ data: nccData, error: nccError } = await supabase
      .from("ncc_registrations")
      .select("*")
      .eq("submittedby", userid)
      .order("created_at", { ascending: false }));

      ({ data: clubData, error: clubError } = await supabase
      .from("club_registrations")
      .select("*")
      .eq("submittedby", userid)
      .order("created_at", { ascending: false }));

      ({ data: instData, error: clubError } = await supabase
      .from("instructor_registrations")
      .select("*")
      .eq("submittedby", userid)
      .order("created_at", { ascending: false }));
    }

    if (nccError) {
      console.error("Error fetching NCC data:", nccError.message);
      return res.status(500).send("Error fetching NCC data");
    }

    if (clubError) {
      console.error("Error fetching club data:", clubError.message);
      return res.status(500).send("Error fetching club data");
    }

    res.render("membership-status", {
      ncc_registrations: nccData,
      club_registrations: clubData,
      instructor_registrations: instData,
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/membership-review/:id", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params;

  try {
    // Fetch the specific registration data
    const { data, error } = await supabase
      .from("ncc_registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching registration:", error.message);
      return res.status(500).send("Error fetching registration");
    }

    // Fetch the applicant user details
    const { data: thisathlete, error: thisathleteError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.submittedby)
      .single();

    if (thisathleteError) {
      console.error("Error fetching applicant user:", thisuserError.message);
      return res.status(500).send("Error fetching applicant user");
    }

    // Render the membership-review.hbs template with the fetched data
    res.render("membership-review", {
      registration: data,
      user: req.session.user,
      thisathlete
    });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server error");
  }
});

app.get("/instructor-review/:id", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params;

  try {
    // Fetch the specific registration data
    const { data, error } = await supabase
      .from("instructor_registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching registration:", error.message);
      return res.status(500).send("Error fetching registration");
    }

    // Fetch the applicant user details
    const { data: thisinstructor, error: thisinstructorError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.submittedby)
      .single();

    if (thisinstructorError) {
      console.error("Error fetching applicant user:", thisinstructorError.message);
      return res.status(500).send("Error fetching applicant user");
    }

    // Render the membership-review.hbs template with the fetched data
    res.render("instructor-review", {
      registration: data,
      user: req.session.user,
      thisinstructor
    });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server error");
  }
});

app.get("/clubreg-review/:id", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  const { id } = req.params;

  try {
    // Fetch the specific registration data
    const { data, error } = await supabase
      .from("club_registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching registration:", error.message);
      return res.status(500).send("Error fetching registration");
    }

    res.render("clubreg-review", {
      clubregistration: data,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server error");
  }
});

app.get("/membership-club", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the specific registration data
    const { data, error } = await supabase;

    if (error) {
      console.error("Error fetching registration:", error.message);
      return res.status(500).send("Error fetching registration");
    }

    // Render the membership-review.hbs template with the fetched data
    res.render("membership-club", {
      registration: data,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).send("Server error");
  }
});

app.get("/analytics", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {

    // Fetch events with name, month created, and event type
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*");

    if (eventsError) throw eventsError;

    // Group events by month created
    const eventsByMonth = events.reduce((acc, event) => {
      const monthCreated = new Date(event.created_at).toLocaleString("default", { month: "long" });
      if (!acc[monthCreated]) acc[monthCreated] = [];
      acc[monthCreated].push(event);
      return acc;
    }, {});

    // Fetch total events
    const { count: eventsCount, error: eventsCountError } = await supabase
      .from("events")
      .select("id", { count: "exact" });
    if (eventsCountError) throw eventsCountError;

    // Fetch transactions data
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("*");
    if (transactionsError) {
      throw transactionsError;
    }

    // Fetch the total number of transactions
    const { count: transactionsCount, error: transactionsCountError } = await supabase
      .from("transactions")
      .select("id", { count: "exact" });

    if (transactionsCountError) {
      throw transactionsCountError;
    }
    const membershiptotalrevenue = transactionsCount * 500; // Assuming each transaction is worth 500
    console.log("Total number of transactions:", transactionsCount);

    // Fetch transactions with type 'NCC'
    const { count: nccTransactionsCount, error: nccTransactionsCountError } = await supabase
      .from("transactions")
      .select("id", { count: "exact" })
      .eq("type", "NCC");

    if (nccTransactionsCountError) {
      throw nccTransactionsCountError;
    }
    console.log("Fetched NCC transactions count:", nccTransactionsCount);

    // Fetch transactions with type 'Instructor'
    const { count: instructorTransactionsCount, error: instructorTransactionsCountError } = await supabase
      .from("transactions")
      .select("id", { count: "exact" })
      .eq("type", "Instructor");

    if (instructorTransactionsCountError) {
      throw instructorTransactionsCountError;
    }
    console.log("Fetched Instructor transactions count:", instructorTransactionsCount);

    // Fetch transactions with type 'Club'
    const { count: clubTransactionsCount, error: clubTransactionsCountError } = await supabase
      .from("transactions")
      .select("id", { count: "exact" })
      .eq("type", "Club");

    if (clubTransactionsCountError) {
      throw clubTransactionsCountError;
    }
    console.log("Fetched Club transactions count:", clubTransactionsCount);

    const totalNccRevenue = nccTransactionsCount * 500; // Assuming each NCC transaction is worth 500
    const totalInstructorRevenue = instructorTransactionsCount * 500; // Assuming each Instructor transaction is worth 500
    const totalClubRevenue = clubTransactionsCount * 500; // Assuming each Club transaction is worth 500

    // Fetch NCC registrations data
    const { data: nccRegistrations, error: nccRegistrationsError } = await supabase
      .from("ncc_registrations")
      .select("*");
    if (nccRegistrationsError) {
      throw nccRegistrationsError;
    }

    // Fetch instructor registrations data
    const { data: instructorRegistrations, error: instructorRegistrationsError } = await supabase
      .from("instructor_registrations")
      .select("*");
    if (instructorRegistrationsError) {
      throw instructorRegistrationsError;
    }

    // Fetch club registrations data
    const { data: clubRegistrations, error: clubRegistrationsError } = await supabase
      .from("club_registrations")
      .select("*");
    if (clubRegistrationsError) {
      throw clubRegistrationsError;
    }
    
    // Fetch the total number of rows in the 'ncc_registrations' table
    const { count: nccRegistrationsCount, error: nccRegistrationsCountError } = await supabase
      .from("ncc_registrations")
      .select("id", { count: "exact" });
    if (nccRegistrationsCountError) {
      throw nccRegistrationsCountError;
    }

        // Fetch NCC registrations with status 1 (under review)
        const { count: underReviewNccsCount, error: underReviewNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 1);
        if (underReviewNccsError) {
          throw underReviewNccsError;
        }
        console.log("Fetched NCC registrations under review count:", underReviewNccsCount);

        const { count: acceptedNccsCount, error: acceptedNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 2);
        if (acceptedNccsError) {
          throw acceptedNccsError;
        }
        console.log("Fetched NCC registrations accepted count:", acceptedNccsCount);

        const { count: idShippedNccsCount, error: idShippedNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 3);
        if (idShippedNccsError) {
          throw idShippedNccsError;
        }
        console.log("Fetched NCC registrations ID shipped count:", idShippedNccsCount);

        const { count: rejectedNccsCount, error: rejectedNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 4);
        if (rejectedNccsError) {
          throw rejectedNccsError;
        }
        console.log("Fetched NCC registrations rejected count:", rejectedNccsCount);

        const { count: expiredNccsCount, error: expiredNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 5);
        if (expiredNccsError) {
          throw expiredNccsError;
        }
        console.log("Fetched NCC registrations expired count:", expiredNccsCount);

        const { count: suspendedNccsCount, error: suspendedNccsError } = await supabase
          .from("ncc_registrations")
          .select("id", { count: "exact" })
          .eq("status", 6);
        if (suspendedNccsError) {
          throw suspendedNccsError;
        }
        console.log("Fetched NCC registrations suspended count:", suspendedNccsCount);

    // Fetch the total number of rows in the 'instructor_registrations' table
    const { count: instructorRegistrationsCount, error: instructorRegistrationsCountError } = await supabase
      .from("instructor_registrations")
      .select("id", { count: "exact" });
    if (instructorRegistrationsCountError) {
      throw instructorRegistrationsCountError;
    }

        // Fetch instructor registrations with status 1 (under review)
        const { count: underReviewInstructorsCount, error: underReviewInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 1);
        if (underReviewInstructorsError) {
          throw underReviewInstructorsError;
        }
        console.log("Fetched Instructor registrations under review count:", underReviewInstructorsCount);

        const { count: enrouteInstructorsCount, error: enrouteInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 2);
        if (enrouteInstructorsError) {
          throw enrouteInstructorsError;
        }
        console.log("Fetched Instructor registrations accepted count:", enrouteInstructorsCount);

        const { count: idShippedInstructorsCount, error: idShippedInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 3);
        if (idShippedInstructorsError) {
          throw idShippedInstructorsError;
        }
        console.log("Fetched Instructor registrations ID shipped count:", idShippedInstructorsCount);

        const { count: rejectedInstructorsCount, error: rejectedInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 4);
        if (rejectedInstructorsError) {
          throw rejectedInstructorsError;
        }
        console.log("Fetched Instructor registrations rejected count:", rejectedInstructorsCount);

        const { count: expiredInstructorsCount, error: expiredInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 5);
        if (expiredInstructorsError) {
          throw expiredInstructorsError;
        }
        console.log("Fetched Instructor registrations expired count:", expiredInstructorsCount);

        const { count: suspendedInstructorsCount, error: suspendedInstructorsError } = await supabase
          .from("instructor_registrations")
          .select("id", { count: "exact" })
          .eq("status", 6);
        if (suspendedInstructorsError) {
          throw suspendedInstructorsError;
        }
        console.log("Fetched Instructor registrations suspended count:", suspendedInstructorsCount);

    // Fetch the total number of rows in the 'club_registrations' table
    const { count: clubRegistrationsCount, error: clubRegistrationsCountError } = await supabase
      .from("club_registrations")
      .select("id", { count: "exact" });
    if (clubRegistrationsCountError) {
      throw clubRegistrationsCountError;
    }
        // Fetch club registrations with status 1 (under review)
        const { count: underReviewClubsCount, error: underReviewClubsError } = await supabase
          .from("club_registrations")
          .select("id", { count: "exact" })
          .eq("status", 1);
        if (underReviewClubsError) {
          throw underReviewClubsError;
        }
        console.log("Fetched Club registrations under review count:", underReviewClubsCount);

        const { count: acceptedClubsCount, error: acceptedClubsError } = await supabase
          .from("club_registrations")
          .select("id", { count: "exact" })
          .eq("status", 3);
        if (acceptedClubsError) {
          throw acceptedClubsError;
        }
        console.log("Fetched Club registrations accepted count:", acceptedClubsCount);

        const { count: rejectedClubsCount, error: rejectedClubsError } = await supabase
          .from("club_registrations")
          .select("id", { count: "exact" })
          .eq("status", 4);
        if (rejectedClubsError) {
          throw rejectedClubsError;
        }
        console.log("Fetched Club registrations rejected count:", rejectedClubsCount);

    console.log("Total number of club registrations:", clubRegistrationsCount);
    console.log("Total number of NCC registrations:", nccRegistrationsCount);
    console.log("Total number of instructor registrations:", instructorRegistrationsCount);

    // Calculate the total number of registrations
    const totalRegistrations =  nccRegistrationsCount + instructorRegistrationsCount + clubRegistrationsCount;

    // Process application data for time-based charts using the existing fetched data
    const processTimeBasedApplications = () => {
      try {
        // Prepare data structures for different time views
        const monthlyData = {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          ncc: Array(12).fill(0),
          instructor: Array(12).fill(0),
          club: Array(12).fill(0),
          total: Array(12).fill(0)
        };
        
        const quarterlyData = {
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          ncc: Array(4).fill(0),
          instructor: Array(4).fill(0),
          club: Array(4).fill(0),
          total: Array(4).fill(0)
        };
        
        const currentYear = new Date().getFullYear();
        const yearlyData = {
          labels: [(currentYear-2).toString(), (currentYear-1).toString(), currentYear.toString()],
          ncc: Array(3).fill(0),
          instructor: Array(3).fill(0),
          club: Array(3).fill(0),
          total: Array(3).fill(0)
        };
        
        // Use the existing registration data instead of making new queries
        
        // Process NCC applications (athlete registrations)
        if (nccRegistrations && nccRegistrations.length > 0) {
          nccRegistrations.forEach(app => {
            if (!app.created_at) return;
            
            const date = new Date(app.created_at);
            const month = date.getMonth();
            const quarter = Math.floor(month / 3);
            const year = date.getFullYear();
            
            // Only count current year for monthly and quarterly views
            if (year === currentYear) {
              monthlyData.ncc[month]++;
              quarterlyData.ncc[quarter]++;
            }
            
            // Count for yearly view if within our 3-year range
            const yearIndex = yearlyData.labels.indexOf(year.toString());
            if (yearIndex !== -1) {
              yearlyData.ncc[yearIndex]++;
            }
          });
        }
        
        // Process Instructor applications
        if (instructorRegistrations && instructorRegistrations.length > 0) {
          instructorRegistrations.forEach(app => {
            if (!app.created_at) return;
            
            const date = new Date(app.created_at);
            const month = date.getMonth();
            const quarter = Math.floor(month / 3);
            const year = date.getFullYear();
            
            if (year === currentYear) {
              monthlyData.instructor[month]++;
              quarterlyData.instructor[quarter]++;
            }
            
            const yearIndex = yearlyData.labels.indexOf(year.toString());
            if (yearIndex !== -1) {
              yearlyData.instructor[yearIndex]++;
            }
          });
        }
        
        // Process Club applications
        if (clubRegistrations && clubRegistrations.length > 0) {
          clubRegistrations.forEach(app => {
            if (!app.created_at) return;
            
            const date = new Date(app.created_at);
            const month = date.getMonth();
            const quarter = Math.floor(month / 3);
            const year = date.getFullYear();
            
            if (year === currentYear) {
              monthlyData.club[month]++;
              quarterlyData.club[quarter]++;
            }
            
            const yearIndex = yearlyData.labels.indexOf(year.toString());
            if (yearIndex !== -1) {
              yearlyData.club[yearIndex]++;
            }
          });
        }
        
        // Calculate totals for each time period
        for (let i = 0; i < 12; i++) {
          monthlyData.total[i] = monthlyData.ncc[i] + monthlyData.instructor[i] + monthlyData.club[i];
        }
        
        for (let i = 0; i < 4; i++) {
          quarterlyData.total[i] = quarterlyData.ncc[i] + quarterlyData.instructor[i] + quarterlyData.club[i];
        }
        
        for (let i = 0; i < 3; i++) {
          yearlyData.total[i] = yearlyData.ncc[i] + yearlyData.instructor[i] + yearlyData.club[i];
        }
        
        // Format data for Chart.js
        const formattedMonthlyData = {
          labels: monthlyData.labels,
          datasets: [
            {
              label: 'Athlete Applications',
              data: monthlyData.ncc,
              borderColor: '#36A2EB',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.3
            },
            {
              label: 'Instructor Applications',
              data: monthlyData.instructor,
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.3
            },
            {
              label: 'Club Applications',
              data: monthlyData.club,
              borderColor: '#FFCE56',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              tension: 0.3
            },
            {
              label: 'Total Applications',
              data: monthlyData.total,
              borderColor: '#4BC0C0',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderWidth: 3,
              tension: 0.3
            }
          ]
        };
        
        const formattedQuarterlyData = {
          labels: quarterlyData.labels,
          datasets: [
            {
              label: 'Athlete Applications',
              data: quarterlyData.ncc,
              borderColor: '#36A2EB',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.3
            },
            {
              label: 'Instructor Applications',
              data: quarterlyData.instructor,
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.3
            },
            {
              label: 'Club Applications',
              data: quarterlyData.club,
              borderColor: '#FFCE56',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              tension: 0.3
            },
            {
              label: 'Total Applications',
              data: quarterlyData.total,
              borderColor: '#4BC0C0',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderWidth: 3,
              tension: 0.3
            }
          ]
        };
        
        const formattedYearlyData = {
          labels: yearlyData.labels,
          datasets: [
            {
              label: 'Athlete Applications',
              data: yearlyData.ncc,
              borderColor: '#36A2EB',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.3
            },
            {
              label: 'Instructor Applications',
              data: yearlyData.instructor,
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              tension: 0.3
            },
            {
              label: 'Club Applications',
              data: yearlyData.club,
              borderColor: '#FFCE56',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              tension: 0.3
            },
            {
              label: 'Total Applications',
              data: yearlyData.total,
              borderColor: '#4BC0C0',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderWidth: 3,
              tension: 0.3
            }
          ]
        };
        
        return {
          monthlyApplicationsData: JSON.stringify(formattedMonthlyData),
          quarterlyApplicationsData: JSON.stringify(formattedQuarterlyData),
          yearlyApplicationsData: JSON.stringify(formattedYearlyData)
        };
      } catch (error) {
        console.error("Error processing time-based application data:", error);
        return {
          monthlyApplicationsData: null,
          quarterlyApplicationsData: null,
          yearlyApplicationsData: null
        };
      }
    };


    
    // Get the time-based application data
    const timeApplicationsData = processTimeBasedApplications();

    // Fetch the total number of users with athleteverified as true
    const { count: athleteVerifiedCount, error: athleteVerifiedCountError } = await supabase
      .from("users")
      .select("id", { count: "exact" })
      .eq("athleteverified", true);

    if (athleteVerifiedCountError) {
      throw athleteVerifiedCountError;
    }

    // Fetch the total number of users with instructorverified as true
    const { count: instructorVerifiedCount, error: instructorVerifiedCountError } = await supabase
      .from("users")
      .select("id", { count: "exact" })
      .eq("instructorverified", true);

    if (instructorVerifiedCountError) {
      throw instructorVerifiedCountError;
    }

    const totalMembers = athleteVerifiedCount + instructorVerifiedCount;

    console.log("Total number of users with instructorverified as true:", instructorVerifiedCount);

    console.log("Total number of users with athleteverified as true:", athleteVerifiedCount);

    // Fetch number of rows in 'clubs' where province is 'Pampanga'
    const provinces = ["Pampanga", "Nueva Ecija", "Tarlac", "Bulacan", "Bataan", "Zambales", "Aurora"];
    const provinceClubCounts = [];

    for (const province of provinces) {
      const { count, error } = await supabase
      .from("clubs")
      .select("id", { count: "exact" })
      .eq("province", province);

      if (error) {
      throw error;
      }

      provinceClubCounts.push({ province, count });
    }

    // Fetch all clubs data
    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("*");

    if (clubsError) {
      throw clubsError;
    }

    console.log("Fetched clubs data:", clubs);

    // Fetch the total number of rows in the 'clubs' table
    const { count: clubsCount, error: clubsCountError } = await supabase
      .from("clubs")
      .select("id", { count: "exact" });

    if (clubsCountError) {
      throw clubsCountError;
    }

    // Fetch competition results per quarter from match_history
    const { data: matchHistory, error: matchHistoryError } = await supabase
      .from("match_history")
      .select("*")
      .eq("ranking", 1);

    if (matchHistoryError) {
      throw matchHistoryError;
    }

    // Fetch all users to map their details to match history rows
    const { data: athletes, error: athletesError } = await supabase
      .from("athletes")
      .select("*");

    if (athletesError) {
      throw athletesError;
    }

    // Group match history by quarter
    const competitionResultsByQuarter = matchHistory.reduce((acc, match) => {
      const matchDate = new Date(match.created_at);
      const quarter = `Q${Math.floor(matchDate.getMonth() / 3) + 1} ${matchDate.getFullYear()}`;

      if (!acc[quarter]) {
      acc[quarter] = [];
      }

      // Map athlete details to the match history row
      const athlete = athletes.find((athlete) => athlete.id === match.athleteid);
      acc[quarter].push({
      ...match,
      athlete: athlete ? { name: athlete.name } : null,
      });

      return acc;
    }, {});

    // Fetch players with the most 1st, 2nd, and 3rd places
    const fetchTopPlayers = async () => {
      try {
        const { data: matchHistory, error: matchHistoryError } = await supabase
          .from("match_history")
          .select("athleteid, ranking");

        if (matchHistoryError) {
          throw matchHistoryError;
        }

        // Count 1st, 2nd, and 3rd places for each athlete
        const rankingCounts = matchHistory.reduce((acc, match) => {
          const { athleteid, ranking } = match;
          if (!acc[athleteid]) {
            acc[athleteid] = { first: 0, second: 0, third: 0 };
          }
          if (ranking === 1) acc[athleteid].first++;
          if (ranking === 2) acc[athleteid].second++;
          if (ranking === 3) acc[athleteid].third++;
          return acc;
        }, {});

        // Convert to array and sort by most 1st places, then 2nd, then 3rd
        const sortedPlayers = Object.entries(rankingCounts)
          .map(([athleteid, counts]) => ({ athleteid, ...counts }))
          .sort((a, b) => b.first - a.first || b.second - a.second || b.third - a.third);

        // Fetch athlete details for the top players
        const topPlayersIds = sortedPlayers.slice(0, 3).map(player => player.athleteid);
        const { data: athletes, error: athletesError } = await supabase
          .from("athletes")
          .select("*")
          .in("id", topPlayersIds);

        if (athletesError) {
          throw athletesError;
        }

        // Map athlete details to the sorted players
        const topPlayers = sortedPlayers.slice(0, 3).map(player => {
          const athlete = athletes.find(a => a.id === parseInt(player.athleteid, 10));
          return { ...player, name: athlete ? athlete.name : "Unknown", portrait: athlete ? athlete.portrait : null };
        });

        console.log("Top players:", topPlayers);
        return topPlayers;
      } catch (error) {
        console.error("Error fetching top players:", error.message);
        return [];
      }
    };

    const topPlayers = await fetchTopPlayers();

    console.log("topplayers:", topPlayers);
    
    console.log("Competition Results by Quarter:", competitionResultsByQuarter);

    console.log("Total number of clubs:", clubsCount);

    console.log("Number of clubs by province:", provinceClubCounts)

    // Render the analytics page with all fetched data
    res.render("analytics", {
      transactions,
      events,
      eventsByMonth,
      eventsCount,
      nccRegistrations,
      instructorRegistrations,
      clubRegistrations,
      user: req.session.user, // Render user session
      provinceClubCounts,
      clubs,
      clubsCount,
      nccRegistrationsCount,
      instructorRegistrationsCount,
      clubRegistrationsCount,
      totalRegistrations,
      totalMembers,
      athleteVerifiedCount,
      instructorVerifiedCount,
      transactionsCount,
      nccTransactionsCount,
      instructorTransactionsCount,
      clubTransactionsCount,
      membershiptotalrevenue,
      totalClubRevenue,
      totalInstructorRevenue,
      totalNccRevenue,
      //NCC statuses
      underReviewNccsCount,
      acceptedNccsCount,
      idShippedNccsCount,
      rejectedNccsCount,
      expiredNccsCount,
      suspendedNccsCount,
      //instructor statuses
      underReviewInstructorsCount,
      enrouteInstructorsCount,
      idShippedInstructorsCount,
      rejectedInstructorsCount,
      expiredInstructorsCount,
      suspendedInstructorsCount,
      //club statuses
      underReviewClubsCount,
      acceptedClubsCount,
      rejectedClubsCount,

      competitionResultsByQuarter,
      topPlayers,
      
      // Add the time-based application data for the line chart
      ...timeApplicationsData
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error.message);
    res.status(500).send("Error fetching analytics data");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Add the admin notification route
app.post('/notify-admins', async (req, res) => {
  try {
    const { changeType, oldValue, newValue, userId, username } = req.body;
    
    // Get all admin users
    const admins = await User.find({ ptaverified: true });
    
    // Create notification message
    const message = `User ${username} (ID: ${userId}) changed their ${changeType}`;
    const details = changeType === 'password' ? 
      'Password was changed' : 
      `Changed from ${oldValue} to ${newValue}`;
    
    // Create notifications for each admin
    const notifications = admins.map(admin => ({
      userId: admin._id,
      message: message,
      details: details,
      type: 'user_update',
      timestamp: new Date(),
      read: false
    }));
    
    // Save notifications to database
    await Notification.insertMany(notifications);
    
    res.status(200).json({ message: 'Admins notified successfully' });
  } catch (error) {
    console.error('Error notifying admins:', error);
    res.status(500).json({ message: 'Failed to notify admins' });
  }
});


