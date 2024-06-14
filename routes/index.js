var express = require('express');
var router = express.Router();
var userModel = require("./users")
var passport = require('passport')
var localStrategy = require('passport-local')
var upload = require('./multer')
var postModel = require('./post')
const commentModel = require("./comment")
var noteModel = require('./note')
var adminModel = require('./admin')


passport.use(new localStrategy(userModel.authenticate()))

// date formation function
function formatPostDate(date) {
  const currentDate = new Date();
  const postDate = new Date(date);
  const timeDifference = currentDate.getTime() - postDate.getTime();

  // Convert milliseconds to seconds
  const seconds = Math.floor(timeDifference / 1000);

  // Calculate the appropriate time units
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  let timeAgo;
  for (const [unit, secondsPerUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsPerUnit);
    if (interval > 0) {
      timeAgo = `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
      break;
    }
  }

  return timeAgo || 'Just now';
}

// truncate function
function truncateText(text, maxLength) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  } else {
    return text;
  }
}

/* GET home page. */
router.get('/', async function (req, res) {
  const user = await userModel.findOne({})
  res.render("welcome", { user, message: null })
})

router.get('/index', isLoggedIn, async function (req, res) {
  try {
    // Fetch the current user's notes
    const user = await userModel.findOne({ username: req.session.passport.user }).populate("notes");

    // Fetch all notes from the database
    const allNotes = await noteModel.find().populate("user");

    // Fetch other necessary data
    const fiveUsers = await userModel.find({}).limit(5);
    const posts = await postModel.find().populate("user");
    const comment = await postModel.find().populate("comments");

    // Format post dates
    posts.forEach(post => {
      post.formatPostDate = formatPostDate(post.createdAt)
    });

    res.render("index", { user, allNotes, posts, truncateText, fiveUsers, comment });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});





// admin panel
router.get("/admin", isAdmin, async function (req, res) {
  try {
    // Find all users and populate their posts and notes
    const users = await userModel.find({})
      .populate("posts")
      .populate("notes");

    // Render the admin panel view with the user data
    res.render("adminPanel", { users });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to render the admin login form
router.get("/adminLogin", async (req, res) => {
  res.render("adminLogin");
});

// Route to handle admin authentication
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the provided credentials match the admin credentials
    const adminData = await adminModel.findOne({ username: username, password: password });

    if (adminData) {
      req.session.isAdminLoggedIn = true; // Set the session variable to indicate admin is logged in
      res.redirect('/admin'); // Redirect to the admin panel
    } else {
      res.redirect('/adminLogin?error=1'); // Redirect back to login with error if authentication fails
    }
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Admin login middleware
function isAdmin(req, res, next) {
  if (req.session.isAdminLoggedIn) { // Check if admin is logged in
    return next();
  }
  res.redirect("/adminLogin"); // Redirect to admin login if not logged in
}


// Delete user route
router.post('/admin/deleteUser/:userId', isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Use findByIdAndDelete to delete the user by its ID
    const deletedUser = await userModel.findByIdAndDelete(userId);

    // Check if the user was found and deleted successfully
    if (!deletedUser) {
      return res.status(404).send('User not found');
    }
    // If successful, send a success response
    res.redirect("back");
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Delete post route
router.post('/admin/deletePost/:postId', isAdmin, async (req, res) => {
  try {
    const postId = req.params.postId;
    // Use findByIdAndDelete to delete the post by its ID
    const deletedPost = await postModel.findByIdAndDelete(postId);
    // Check if the post was found and deleted successfully
    if (!deletedPost) {
      return res.status(404).send('Post not found');
    }
    // If successful, send a success response
    res.redirect("back")
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Internal Server Error');
  }
});



// POST route to handle note creation or update
router.post('/user/sharenote', isLoggedIn, async (req, res) => {
  try {
    const { note } = req.body;

    // Validate note content
    if (!note || note.trim() === '' || note.split(/\s+/).length > 20) {
      return res.status(400).send('Note content is invalid or exceeds 20 words');
    }

    // Find the user
    const user = await userModel.findOne({ username: req.session.passport.user });

    // Check if the user already has a note
    let existingNote = await noteModel.findOne({ user: user._id });

    if (existingNote) {
      // Update the existing note with the new content
      existingNote.note = note.trim(); // Update note content
      await existingNote.save();
      console.log('Existing note updated:', existingNote._id);
    } else {
      // Create a new note document
      existingNote = new noteModel({
        note: note.trim(), // Remove leading and trailing whitespace
        user: user._id // Assign the user's ID to the note
      });

      // Save the note to the database
      await existingNote.save();
      console.log('New note created:', existingNote._id);
    }

    // Schedule the deletion of the new note after 24 hours
    setTimeout(async () => {
      // Delete the note from the database
      const deletionResult = await noteModel.deleteOne({ _id: existingNote._id });
      console.log('Note deleted after 24 hours:', existingNote._id);
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Redirect to the same page
    res.redirect('back');
  } catch (error) {
    console.error('Error sharing note:', error);
    res.status(500).send('Internal Server Error');
  }
});


// DELETE route to handle note deletion
router.delete('/notes/:noteId', isLoggedIn, async (req, res) => {
  try {
    const noteId = req.params.noteId;
    // Delete note from the database
    await noteModel.findByIdAndDelete(noteId);
    res.sendStatus(204); // No content response
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).send('Internal Server Error');
  }
});









router.delete('/post/:postId', isLoggedIn, async (req, res) => {
  try {
    const postId = req.params.postId;

    // Find the post by ID
    const post = await postModel.findById(postId);

    // Check if the post exists
    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Check if the currently logged-in user is the owner of the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).send('You are not authorized to delete this post');
    }

    // Delete the post from the database
    const result = await postModel.deleteOne({ _id: postId });

    // Check if any post was deleted
    if (result.deletedCount === 0) {
      return res.status(404).send('Post not found');
    }

    // Send a success response
    res.status(200).send('Post deleted successfully');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Internal Server Error');
  }
});










// route to each post
router.get("/post/:id", isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const post = await postModel.findOne({ _id: req.params.id })
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          model: 'user'
        }
      }).populate("user")

    //  Fetch all notes from the database
    const allNotes = await noteModel.find().populate("user");

    post.formatPostDate = formatPostDate(post.createdAt);

    // Format comment creation dates

    post.comments.forEach((elem) => {
      elem.time = formatPostDate(elem.createdAt)
    })

    const fiveUsers = await userModel.find({}).limit(5);
    res.render("singlepost", { user, post, fiveUsers, allNotes });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).send("Internal Server Error");
  }
});




// edit profile router
router.get("/editProfile", isLoggedIn, async function (req, res) {
  const user = await userModel.find({ username: req.session.passport.user })
  res.render("editProfile", { user })
})


// search username router
router.get("/username/:username", async (req, res) => {
  const regex = new RegExp(`^${req.params.username}`, 'i')
  const users = await userModel.find({ username: regex })
  res.json(users);
})



// profile router
router.get('/:username', isLoggedIn, async function (req, res) {
  try {
    const username = req.params.username;
    const user = await userModel.findOne({ username: username }).populate("posts").populate("gallery"); // Populate the gallery field

    if (!user) {
      // Handle user not found
      return res.status(404).send("User not found");
    }

    res.render("profile", { user, formatPostDate });
  } catch (error) {
    console.log(error.message);
    // Handle errors appropriately
    res.status(500).send("Internal Server Error");
  }
});



// hitting like
router.post("/like/post/:id", isLoggedIn, async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const post = await postModel.findOne({ _id: req.params.id });

    // If already liked, remove like
    if (post.likes.includes(user._id)) {
      post.likes.pull(user._id);
    } else {
      // If not liked, add like
      post.likes.push(user._id);
    }

    await post.save();
    const updatedPost = await postModel.findOne({ _id: req.params.id });

    res.json({ success: true, liked: post.likes.includes(user._id), likesCount: updatedPost.likes.length });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});


// creating user
router.post('/createUser', async function (req, res, next) {
  try {
    // Check if the username already exists in the database
    const existingUser = await userModel.findOne({ username: req.body.username }).exec();
    if (existingUser) {
      // If the username already exists, render the signup page with an error message
      return res.render('welcome', { isAuthenticated: false, message: 'Username already exists' });
    }

    // If the username is not taken, proceed with creating the new user
    const userData = new userModel({
      username: req.body.username,
      name: req.body.name,
      password: req.body.password,
    });



    await userModel.register(userData, req.body.password);
    passport.authenticate('local')(req, res, function () {
      res.redirect('/index');
    });
  } catch (error) {
    // Handle any errors that occur during the process
    next(error);
  }
});



// Route to check the availability of a username
router.post('/checkUsername', async function (req, res) {
  try {
    const existingUser = await userModel.findOne({ username: req.body.username }).exec();
    if (existingUser) {
      // If the username already exists, send a response indicating that it's taken
      return res.json({ message: 'Username already exists' });
    }
    // If the username is not taken, send a response indicating that it's available
    res.json({ message: '' });
  } catch (error) {
    // Handle any errors
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


















// edit profile
// Edit profile
router.post("/editProfile", upload.single("userPhoto"), async (req, res) => {
  try {
    const username = req.body.username;
    const name = req.body.name;
    let userPhoto;

    // Check if a new photo is uploaded
    if (req.file) {
      userPhoto = req.file.filename;
    }

    // Find the user by username
    const user = await userModel.findOne({ username: req.session.passport.user });

    // Update the user's data based on the provided fields
    if (username) {
      user.username = username;
    }
    if (name) {
      user.name = name;
    }
    if (userPhoto) {
      user.userPhoto = userPhoto;
    }

    // Save the updated user data
    await user.save();

    res.redirect("/index");
  } catch (error) {
    console.error("Error editing profile:", error);
    res.status(500).send("Internal Server Error");
  }
});



// edit profile picture
router.post("/updateProfilePicture", upload.single("userPhoto"), async (req, res) => {
  try {
    // Find the user by username
    const user = await userModel.findOne({ username: req.session.passport.user });

    // Check if a new photo is uploaded
    if (req.file) {
      // If a new photo is uploaded, update the profile picture
      user.userPhoto = req.file.filename;

      // Add the new photo to the gallery
      if (!user.gallery.includes(req.file.filename)) {
        user.gallery.push(req.file.filename);
      }
    }

    // Save the updated user data
    await user.save();

    res.redirect("back");
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).send("Internal Server Error");
  }
});




// post a comment
router.post('/post/:postId/comment', isLoggedIn, async (req, res) => {
  try {
    const postId = req.params.postId;
    const { textComment } = req.body;
    const userId = req.user._id;

    // Create a new comment
    const comment = new commentModel({
      textComment: textComment,
      user: userId,
      post: postId
    });

    // Save the comment to the database
    await comment.save();

    // Find the post and add the comment to its comments array
    const post = await postModel.findById(postId);
    post.comments.push(comment);
    await post.save();

    // Find the user and add the comment to their comments array
    const user = await userModel.findById(userId);
    user.comments.push(comment);
    await user.save();

    // Send the newly created comment back as a JSON response
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).send('Internal Server Error');
  }
});










// create post
router.post("/createPost", isLoggedIn, upload.single("picture"), async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });

  let pictureFileName = null;
  if (req.file) {
    pictureFileName = req.file.filename;
  }

  // Check if any of the fields (picture, title, content) is provided
  if (pictureFileName || req.body.title || req.body.content) {
    // Check if title exceeds 70 characters
    if (req.body.title && req.body.title.length > 70) {
      return res.status(400).send("Title must be less than or equal to 70 characters.");
    }

    // Check if content exceeds 4000 characters
    if (req.body.content && req.body.content.length > 4000) {
      return res.status(400).send("Content must be less than or equal to 4000 characters.");
    }

    const post = await postModel.create({
      picture: pictureFileName,
      title: req.body.title,
      user: user._id,
      content: req.body.content
    });

    // Update user's posts array
    user.posts.push(post._id);
    await user.save();
  }

  res.redirect("back");
});








// login route
router.post("/login", passport.authenticate("local", {
  successRedirect: "/index",
  failureRedirect: "/"
}), (req, res) => {
})



// log out 
router.get("/logout/destroySession", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err)
    }
    res.redirect("/")
  })
})



//  is logged in 
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();

  }
  res.redirect("/")
}

module.exports = router;