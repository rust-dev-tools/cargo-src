extern crate hyper;

use hyper::Server;
use hyper::server::Request;
use hyper::server::Response;

fn hello(_: Request, res: Response) {
    res.send(b"Hello World!").unwrap();
}

fn main() {
    println!("server running on 127.0.0.1:3000");
    
    Server::http("127.0.0.1:3000").unwrap().handle(hello).unwrap();
}
