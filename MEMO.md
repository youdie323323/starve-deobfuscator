# How to Enable Google Login

Follow these steps to enable google login:

1. Make the WebAssembly on-ready function asynchronous (async) and make on-ready call as await.

2. Find the following code at the end of deobfuscated client code:
    ```javascript
    *.gapi.load("auth2", *);
    ```
    Copy this code and delete the onload assignment.

3. Paste the copied code into the function that runs when WebAssembly is loaded, and use `await` to call it.

Done. You can now log in with Google.

![image](https://github.com/user-attachments/assets/7620d148-ac1c-4adb-a4c1-73e0d0cc27aa)
![image](https://github.com/user-attachments/assets/5b964dc7-f519-400f-9c2f-9e5127d37de6)
