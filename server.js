require('dotenv').config();
const sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
const express = require('express');
const fs = require('fs');
const port = 3000;

class Application {

    /**
     * express application
     * 
     * @private
     * @type {Express}
     */
    // app = express();

    /**
     * build application instance
     * 
     * @constructor
     */
    constructor() {
        this.app = express();
        this.middlewares();
        this.routes();
        this.errors();
    }

    /**
     * global middlewares
     * 
     * @private
     * @returns {undefined}
     */
    middlewares() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({
            extended: true
        }));
    }

    /**
     * add routes
     * 
     * @private
     * @returns {undefined}
     */
    routes() {
        // form validation using a middleware
        this.app.post(
            '/register',
            (req, res, next) => {
                let data = JSON.parse(fs.readFileSync('data.json'));
                let errors = [];

                if (Object.values(data).includes(req.body.email)) {
                    errors.push({
                        email: 'email must be unique'
                    });
                }
                if (req.body.password !== req.body.confirmPassword) {
                    errors.push({
                        password: 'passwords do not match'
                    });
                }

                errors.length ? res.status(422).send(errors) : next();
            },
            (req, res) => {
                res.status(200).send('Thank you for registering');
                let data = JSON.parse(fs.readFileSync('data.json'));
                console.log(data);
            }
        );

        // - login user using email address only
        // - get list of user emails from data.json asynchronously, and catch any errors
        // - if login email is not found in list of user emails then send failed response with correct status code
        // - send success response if user is found
        this.app.post('/login', (req, res, next)=>{
            fs.readFile('data.json', (err, data)=>{
                let errors = [];
                if (err){
                    console.log(err);
                    errors.push({file: 'Internal server error'});
                }
                else{
                    const parsedData = JSON.parse(data);
                    //validate using email address only
                    if (!Object.values(parsedData).includes(req.body.email)){
                        errors.push({email: 'The email address could not be found.'});
                    }
                }
                errors.length ? res.status(422).send(errors): next();
            });
        }, (req, res) => res.status(200).send('You are now logged in.'));


        // error in synchronous code
        this.app.get('/panic/sync', (req, res) => {
            throw new Error("synchronous error");
        });

        // error in asynchronous code
        this.app.get('/panic/async', (req, res, next) => {
            Promise.reject(new Error("asynchronous error")).catch(error => next(error));
        });

        // custom not found error
        this.app.get('*', (req, res) => {
            throw Object.assign(new Error('Page not found on this path: ' + req.originalUrl), {
                name: 404
            });
        });
    }

    /**
     * handle errors
     * 
     * @private
     * @returns {undefined}
     */
    errors() {
        // write to log file
        this.app.use((err, req, res, next) => {
            // - add timestamp to error logs
            fs.appendFileSync('errors.log', JSON.stringify(err, ['name', 'message', 'stack'], 4) + '\r\n');
            next(err);
        });

        // - send an alert to email using sendgrid, and call next error handler
        this.app.use((err, req, res, next)=>{
            //send email
            console.log("Attempting to send email");
            const message = {
                to: 'mustafamohamed4014@gmail.com',
                subject: 'You have an error in the application Error Handling',
                text: err.message || 'Oops! Something\'s not right.',
                from: 'mustafa.mohamed.mus@gmail.com',
            };
            sendgrid.send(message).then(()=>{}, error=>{
                console.log(error);
                if (error.response){
                    console.error(error.response.body);
                }
            });
            next(err);
        })

        // not found error
        this.app.use((err, req, res, next) => {
            err.name == 404 ?
                res.status(404).send(err.message || 'Oops! Resource not found') :
                next(err);
        });
        

        // default server error
        this.app.use((err, req, res, next) => {
            res.status(500).send(err.message || 'Oops! Server failed');
        });
    }

    /**
     * launch server
     * 
     * @public
     * @returns {undefined}
     */
    serve() {
        this.app.listen(port, () => console.log('server running on:', port));
    }
}

new Application().serve();