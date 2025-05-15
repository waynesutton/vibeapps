How to Install and Setup Clerk Authentication In React JS With Basic Login & Signup Components

1. 00:00 Okay so in today's tutorial I'm going to be showing you how to create a cleric login and sign up using the cleric components and also I'm going to be showing you how to install it into your project. So let's get started okay. So the first thing you need to do is sign up and to do that just go to get started after that you'll be shown. This page you can use GitHub or Google to create an account or just fill in the form and press continue. You. After that you will receive a after that you will receive a verification code in your email just put that in and you'll be able to log into your account. But I've already created mine so. I'm going to sign in just put in your email address. After that you will be able to log in to your account after entering your email and password. After that you will see this you can create a new application. Okay I've already created one and I'm going to be using this one but if you want to create a new one it's really simple.

2. 01:35 This is a demo of what your signin component will look like and you can activate and deactivate different things here. Like for example. Here we go if I do this then you'll see that Google and GitHub are both options that I can use to sign into my account and the email address is an option okay and here you can give your application a name and activate and deactivate different ways of signing in you can even use something like a phone number or username.

3. 02:11 I think this one is limited to the paid version but for the free version everything else will work okay. So I'm not actually going to create this because I've already created one just going to go back and use this one and then you'll see different options to install this. I'm going to be using this after that just copy your API key now let's create a enem file and this is to secure our environment. Variable. Dot EnV do local and inside this you are going to put I'm going to call this cler score key.

4. 03:17 It's equal to then you just put in your key save this and now go to your main. GSX here is where we are going to set up or cleric but before that we need to install it so close your server run the command npm install at CL slash. Cleric Dash react and then press enter okay cleric is installed now. Let's start the server and while that is starting we will set up. We will set up the cleric provider and first we are going to get the key that we installed in our EnV file so to do that let's create a variable first. I'm going to call Clare.

5. 04:32 Key and I'm going to say import dot meta dot EnV dot now since I'm using V I'm going to use underscore then the name of the key which is key okay and I'm going to create a if here so that I can get an error and to check this all I'm going to say is ER Key and adding not so if this is empty. Then just throw this error so first let's check. This out. Let's do a console log okay so before we move forward. I'm going to change the name of our EnV variable to feed cler key because you need to add this for the environment variables to work okay. So we did not receive any errors that means our key is working and now what you need to do.

6. 06:40 Here is go to is add. The component click provider add your app into this save and then you need to provide the key into a prop called okay and just put in the cler key go to wherever you have set up your routing okay and here we are going to add the login component that is pre-made for us using cleric and also the signup one and I've already set up the routes you should know how to use react router so just going to add this okay as you can see and it's the same for the sign up okay. This the page we're going to go to after we have signed in okay so right now our components should be added okay. So the reason we received.

7. 08:33 This error is because save this and reason we received this error is because the K is capital okay. Now you can see that when this reloads as you can see it's working now okay.

8. 08:59 I'm just going to going to quickly add some styling to Center this okay. Now that is some styling to the component and now I can either use a email or a username to sign in and the sign up page is also set so if I go to sign up okay as you can see sign up is already here we can enter a username email and password or use Google but before any of this works we need to set it up so that when we end up signing up that it automatically s sends a verification code to our email and also ends up redirecting us as soon as we enter that verification code so right now. This was a simple way just to show you that this was working now I'm going to divide this up into two components and I'm just going to create a few pages here and I'll just quickly do that and then come back okay so now I've created the three different components.
   Uh I'm not going to be doing this one because I'm going to create another video how you can create your custom signup. We're going to be using this for that and right now I'm going to be focusing on the login and sign up using the pre-made components. So it's really simple what I did I just added this into the the signin component that comes with cleric into this and just added some styling I'm using bootstrap by the way you can use Tailwind if you want doesn't matter and I've just added that component into this okay and that's it I've just saved that and as you can see you're getting this right. Now. I'm going to be making a few more cleric tutorials and after we get to 1,000 subscribers. We will be making full stack tutorials so I hope you like this tutorial like. And subscribe and I'll see you in the next one bye.

How to Install and Setup Clerk Authentication In React JS With Basic Login & Signup Components

TLDR: The video provides a step-by-step guide on how to integrate Clerk authentication into a React application, including account creation, environment setup, and component styling.

1. 00:00 🔑 Create a Clerk account using GitHub, Google, or a form, verify your email, and log in to set up your application.

2. 01:35 🔑 Sign in options for your application can include Google, GitHub, email, phone number, or username, with the ability to activate or deactivate each method.

3. 02:11 🔑 To secure your environment, create a .env file and add your Clerk API key as a variable.

4. 03:17 🔑 Install Clerk in React by running `npm install @clerk/clerk-react`, then set up the Clerk provider using your API key from the .env file.

5. 04:32 🔑 Import and configure the environment variable for Clerk authentication in React, ensuring the key is correctly set to avoid errors.

6. 06:40 🔑 Add Clerk authentication to your React app by integrating the provider with your routing and using pre-made login and signup components.

7. 08:33 🔧 Fix the error by ensuring the capital 'K' is saved correctly, and the application will work after reloading.

8. 08:59 🎨 Set up styled login/signup components with email verification in React using Clerk and Bootstrap.
   8.1 Styled the login and signup components for email or username authentication, set up email verification, and created three separate components for better organization.
   8.2 The video demonstrates how to implement login and signup functionality in React using pre-made Clerk components and Bootstrap for styling.

Summary for: https://youtu.be/6g95ioeiE6Q
